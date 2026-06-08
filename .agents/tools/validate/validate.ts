import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { constants as osConstants } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ValidateGateConfig {
  name: string;
  command: string;
}

export interface ValidateConfig {
  logDir: string;
  pollIntervalMs: number;
  metaGraceMs: number;
  staleLockMs: number;
  timeoutMs: number;
  gates: ValidateGateConfig[];
}

export interface GateResult {
  status: "passed" | "failed";
  exitCode: number | null;
  signal: string | null;
  log: string;
}

export interface ValidateResult {
  ok: boolean;
  runId: string;
  gateKey: string;
  head: string | null;
  dirty: boolean | null;
  latched: boolean;
  startedAt: number;
  finishedAt: number;
  gates: Record<string, GateResult>;
  errors?: string[];
}

export interface GateProgress {
  gate: string;
  status: "passed" | "failed";
  exitCode: number | null;
  signal: string | null;
  durationMs: number;
  log: string;
}

export interface ValidateReapHookInfo {
  lockDir: string;
  claimDir: string;
  gateKey: string;
  expected: {
    pid: number;
    runId: string;
    gateKey: string;
    startedAt: number;
  } | null;
}

export interface ValidateCoordinationHooks {
  beforeClaimStaleLock?: (info: ValidateReapHookInfo) => void | Promise<void>;
  beforeRestoreClaimedLock?: (info: ValidateReapHookInfo) => void | Promise<void>;
}

export interface ValidateOptions {
  gates?: string[];
  repoRoot?: string;
  onProgress?: (progress: GateProgress) => void;
  onWarning?: (message: string) => void;
  coordinationHooks?: ValidateCoordinationHooks;
}

interface TreeState {
  head: string | null;
  dirty: boolean | null;
}

interface LockMeta extends TreeState {
  pid: number;
  runId: string;
  gateKey: string;
  startedAt: number;
}

interface OwnerContext extends TreeState {
  runId: string;
  gateKey: string;
  startedAt: number;
  runDir: string;
  releaseLock: boolean;
  publishLatest: boolean;
}

interface ReapExpectation {
  pid: number;
  runId: string;
  gateKey: string;
  startedAt: number;
}

type MetaRead =
  | { kind: "valid"; meta: LockMeta }
  | { kind: "missing" }
  | { kind: "malformed" };

type ContentionAction =
  | { kind: "owner"; context: OwnerContext }
  | { kind: "result"; result: ValidateResult }
  | { kind: "continue" }
  | { kind: "error"; result: ValidateResult };

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = resolve(__dirname, "../../..");

export function readStatus(config: ValidateConfig): ValidateResult | { status: "none" } {
  const latestPath = join(config.logDir, "result.json");
  if (!existsSync(latestPath)) return { status: "none" };
  return JSON.parse(readFileSync(latestPath, "utf-8")) as ValidateResult;
}

export async function runValidate(config: ValidateConfig, opts: ValidateOptions = {}): Promise<ValidateResult> {
  const normalized = normalizeConfig(config);
  const repoRoot = opts.repoRoot ?? DEFAULT_REPO_ROOT;
  const selected = selectGates(normalized, opts.gates);
  const startedForError = Date.now();

  if ("error" in selected) {
    return errorResult(selected.gateKey, selected.error, startedForError);
  }

  const gateKey = gateKeyFor(selected.gates.map((gate) => gate.name));
  const deadline = Date.now() + normalized.timeoutMs;
  const paths = pathsFor(normalized);

  try {
    mkdirSync(paths.logDir, { recursive: true });
    mkdirSync(paths.runsDir, { recursive: true });
  } catch (error) {
    return errorResult(gateKey, `unable to prepare validate log directories: ${errorMessage(error)}`, startedForError);
  }

  while (Date.now() <= deadline) {
    const tree = captureTreeState(repoRoot);
    const startedAt = Date.now();
    const runId = createRunId(startedAt);

    try {
      mkdirSync(paths.lockDir);
      const context = ownerContext(normalized, runId, gateKey, startedAt, tree, true, true);
      publishMeta(paths.lockMetaPath, {
        pid: process.pid,
        runId,
        gateKey,
        head: tree.head,
        dirty: tree.dirty,
        startedAt,
      });
      return await runOwner(normalized, selected.gates, context, repoRoot, opts);
    } catch (error) {
      const code = errorCode(error);
      if (code === "EEXIST") {
        const action = await handleContention(normalized, selected.gates, gateKey, repoRoot, opts, deadline);
        if (action.kind === "owner") {
          return await runOwner(normalized, selected.gates, action.context, repoRoot, opts);
        }
        if (action.kind === "result") return action.result;
        if (action.kind === "error") return action.result;
        continue;
      }

      if (isLockInfrastructureError(code)) {
        return await runUnlatched(normalized, selected.gates, gateKey, repoRoot, opts, error);
      }

      return errorResult(gateKey, `unable to acquire validate lock: ${errorMessage(error)}`, startedAt);
    }
  }

  return errorResult(gateKey, `timed out after ${normalized.timeoutMs}ms waiting for validate coordination`, Date.now());
}

function normalizeConfig(config: ValidateConfig): ValidateConfig {
  return {
    ...config,
    pollIntervalMs: config.pollIntervalMs ?? 250,
    metaGraceMs: config.metaGraceMs ?? 2_000,
    staleLockMs: config.staleLockMs ?? 1_800_000,
    timeoutMs: config.timeoutMs ?? 2_400_000,
    gates: config.gates ?? [],
  };
}

function selectGates(config: ValidateConfig, requested?: string[]): { gates: ValidateGateConfig[] } | { error: string; gateKey: string } {
  const byName = new Map(config.gates.map((gate) => [gate.name, gate]));
  const requestedNames = requested && requested.length > 0 ? requested : config.gates.map((gate) => gate.name);
  const unknown = requestedNames.filter((name) => !byName.has(name));
  const gateKey = gateKeyFor(requestedNames);

  if (unknown.length > 0) {
    return { error: `unknown gate(s): ${unknown.join(", ")}`, gateKey };
  }

  const requestedSet = new Set(requestedNames);
  return { gates: config.gates.filter((gate) => requestedSet.has(gate.name)) };
}

function gateKeyFor(names: string[]): string {
  return [...new Set(names)].sort().join(",");
}

function pathsFor(config: ValidateConfig) {
  const logDir = config.logDir;
  const runsDir = join(logDir, "runs");
  const lockDir = join(logDir, "lock");
  return {
    logDir,
    runsDir,
    lockDir,
    lockMetaPath: join(lockDir, "meta.json"),
    latestResultPath: join(logDir, "result.json"),
  };
}

function ownerContext(
  config: ValidateConfig,
  runId: string,
  gateKey: string,
  startedAt: number,
  tree: TreeState,
  releaseLock: boolean,
  publishLatest: boolean,
): OwnerContext {
  return {
    runId,
    gateKey,
    startedAt,
    head: tree.head,
    dirty: tree.dirty,
    runDir: join(config.logDir, "runs", runId),
    releaseLock,
    publishLatest,
  };
}

async function handleContention(
  config: ValidateConfig,
  gates: ValidateGateConfig[],
  gateKey: string,
  repoRoot: string,
  opts: ValidateOptions,
  deadline: number,
): Promise<ContentionAction> {
  const paths = pathsFor(config);
  const read = readMeta(paths.lockMetaPath);

  if (read.kind !== "valid") {
    const shouldReap = await badMetaIsReapable(config, paths.lockDir, paths.lockMetaPath, deadline);
    if (!shouldReap) return { kind: "continue" };
    return await tryReapAndAcquire(config, gateKey, repoRoot, opts, deadline, null);
  }

  const meta = read.meta;
  if (!pidIsAlive(meta.pid)) {
    return await tryReapAndAcquire(config, gateKey, repoRoot, opts, deadline, meta);
  }

  if (Date.now() - meta.startedAt > config.staleLockMs) {
    return await tryReapAndAcquire(config, gateKey, repoRoot, opts, deadline, meta);
  }

  if (meta.gateKey === gateKey) {
    return latchToRun(config, meta, deadline);
  }

  await sleep(config.pollIntervalMs);
  return { kind: "continue" };
}

async function badMetaIsReapable(
  config: ValidateConfig,
  lockDir: string,
  lockMetaPath: string,
  deadline: number,
): Promise<boolean> {
  await sleepWithinDeadline(config.pollIntervalMs, deadline);
  if (readMeta(lockMetaPath).kind === "valid") return false;

  try {
    const stats = statSync(lockDir);
    const lockAgeMs = Date.now() - Math.min(stats.birthtimeMs || stats.mtimeMs, stats.mtimeMs);
    return lockAgeMs > config.metaGraceMs;
  } catch {
    return false;
  }
}

async function tryReapAndAcquire(
  config: ValidateConfig,
  gateKey: string,
  repoRoot: string,
  opts: ValidateOptions,
  deadline: number,
  expected: ReapExpectation | null,
): Promise<ContentionAction> {
  if (Date.now() > deadline) {
    return { kind: "error", result: errorResult(gateKey, `timed out after ${config.timeoutMs}ms waiting for validate coordination`, Date.now()) };
  }

  const paths = pathsFor(config);
  const claimDir = `${paths.lockDir}.reaping.${process.pid}.${randomHex(3)}`;
  const hookInfo = { lockDir: paths.lockDir, claimDir, gateKey, expected };

  await opts.coordinationHooks?.beforeClaimStaleLock?.(hookInfo);

  try {
    renameSync(paths.lockDir, claimDir);
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT" || code === "EEXIST") return { kind: "continue" };
    return { kind: "error", result: errorResult(gateKey, `unable to claim stale validate lock: ${errorMessage(error)}`, Date.now()) };
  }

  const claimed = readMeta(join(claimDir, "meta.json"));
  if (!claimedLockIsReapable(config, claimed, expected)) {
    await opts.coordinationHooks?.beforeRestoreClaimedLock?.(hookInfo);
    try {
      renameSync(claimDir, paths.lockDir);
    } catch (error) {
      if (isRestoreContentionError(errorCode(error))) {
        rmSync(claimDir, { recursive: true, force: true });
        return { kind: "continue" };
      }
      return { kind: "error", result: errorResult(gateKey, `unable to restore live validate lock: ${errorMessage(error)}`, Date.now()) };
    }
    return { kind: "continue" };
  }

  try {
    mkdirSync(paths.lockDir);
  } catch (error) {
    rmSync(claimDir, { recursive: true, force: true });
    if (errorCode(error) === "EEXIST") return { kind: "continue" };
    return { kind: "error", result: errorResult(gateKey, `unable to reacquire validate lock after reaping: ${errorMessage(error)}`, Date.now()) };
  }

  rmSync(claimDir, { recursive: true, force: true });

  const tree = captureTreeState(repoRoot);
  const startedAt = Date.now();
  const runId = createRunId(startedAt);
  const context = ownerContext(config, runId, gateKey, startedAt, tree, true, true);
  publishMeta(paths.lockMetaPath, {
    pid: process.pid,
    runId,
    gateKey,
    head: tree.head,
    dirty: tree.dirty,
    startedAt,
  });

  return { kind: "owner", context };
}

function claimedLockIsReapable(config: ValidateConfig, claimed: MetaRead, expected: ReapExpectation | null): boolean {
  if (expected) {
    return (
      claimed.kind === "valid" &&
      claimed.meta.pid === expected.pid &&
      claimed.meta.runId === expected.runId &&
      claimed.meta.gateKey === expected.gateKey &&
      claimed.meta.startedAt === expected.startedAt
    );
  }

  if (claimed.kind !== "valid") return true;
  return !pidIsAlive(claimed.meta.pid) || Date.now() - claimed.meta.startedAt > config.staleLockMs;
}

async function latchToRun(config: ValidateConfig, target: LockMeta, deadline: number): Promise<ContentionAction> {
  const paths = pathsFor(config);
  const targetResultPath = join(paths.runsDir, target.runId, "result.json");

  while (Date.now() <= deadline) {
    const result = readResultIfPresent(targetResultPath);
    if (result) return { kind: "result", result: { ...result, latched: true } };

    await sleepWithinDeadline(config.pollIntervalMs, deadline);

    const afterSleep = readResultIfPresent(targetResultPath);
    if (afterSleep) return { kind: "result", result: { ...afterSleep, latched: true } };

    const current = readMeta(paths.lockMetaPath);
    if (current.kind === "missing") {
      const final = readResultIfPresent(targetResultPath);
      if (final) return { kind: "result", result: { ...final, latched: true } };
      return { kind: "continue" };
    }

    if (current.kind !== "valid") {
      return { kind: "continue" };
    }

    if (current.meta.runId !== target.runId || current.meta.gateKey !== target.gateKey) {
      const final = readResultIfPresent(targetResultPath);
      if (final) return { kind: "result", result: { ...final, latched: true } };
      return { kind: "continue" };
    }

    if (!pidIsAlive(target.pid)) {
      const graceful = await waitForResult(targetResultPath, Math.min(config.metaGraceMs, Math.max(0, deadline - Date.now())), config.pollIntervalMs);
      if (graceful) return { kind: "result", result: { ...graceful, latched: true } };
      return { kind: "continue" };
    }

    if (Date.now() - current.meta.startedAt > config.staleLockMs) {
      return { kind: "continue" };
    }
  }

  return { kind: "error", result: errorResult(target.gateKey, `timed out after ${config.timeoutMs}ms waiting for validate result ${target.runId}`, Date.now()) };
}

async function runUnlatched(
  config: ValidateConfig,
  gates: ValidateGateConfig[],
  gateKey: string,
  repoRoot: string,
  opts: ValidateOptions,
  cause: unknown,
): Promise<ValidateResult> {
  const tree = captureTreeState(repoRoot);
  const startedAt = Date.now();
  const runId = `unlatched-${process.pid}-${startedAt}-${randomHex(3)}`;
  opts.onWarning?.(`validate lock unavailable; running unlatched in pid-isolated path (${errorMessage(cause)})`);
  const context = ownerContext(config, runId, gateKey, startedAt, tree, false, false);
  return runOwner(config, gates, context, repoRoot, opts);
}

async function runOwner(
  config: ValidateConfig,
  gates: ValidateGateConfig[],
  context: OwnerContext,
  repoRoot: string,
  opts: ValidateOptions,
): Promise<ValidateResult> {
  const paths = pathsFor(config);

  try {
    mkdirSync(context.runDir, { recursive: true });
    const settledGateResults = await Promise.allSettled(gates.map((gate) => runGate(gate, context.runDir, repoRoot, opts)));
    const gateResults = settledGateResults.map((settled) => {
      if (settled.status === "rejected") throw settled.reason;
      return settled.value;
    });
    const gateMap: Record<string, GateResult> = {};

    for (const { name, result } of gateResults) {
      gateMap[name] = result;
    }

    const result: ValidateResult = {
      ok: gateResults.every(({ result: gateResult }) => gateResult.status === "passed"),
      runId: context.runId,
      gateKey: context.gateKey,
      head: context.head,
      dirty: context.dirty,
      latched: false,
      startedAt: context.startedAt,
      finishedAt: Date.now(),
      gates: gateMap,
    };

    writeJsonAtomic(join(context.runDir, "result.json"), result);
    if (context.publishLatest) {
      writeJsonAtomic(paths.latestResultPath, result);
    }

    return result;
  } catch (error) {
    return ownerErrorResult(context, `unable to run validate owner: ${errorMessage(error)}`);
  } finally {
    if (context.releaseLock) {
      releaseOwnedLock(paths.lockDir, paths.lockMetaPath, context);
    }
  }
}

function runGate(
  gate: ValidateGateConfig,
  runDir: string,
  repoRoot: string,
  opts: ValidateOptions,
): Promise<{ name: string; result: GateResult }> {
  return new Promise((resolveGate) => {
    const startedAt = Date.now();
    const log = join(runDir, `${safeLogName(gate.name)}.log`);
    const fd = openSync(log, "w");
    let settled = false;

    const finish = (exitCode: number | null, signal: string | null, spawnError?: unknown) => {
      if (settled) return;
      settled = true;
      if (spawnError) {
        writeSync(fd, `spawn error: ${errorMessage(spawnError)}\n`);
      }
      closeSync(fd);

      const normalized = normalizeSignalExit(exitCode, signal);
      const result: GateResult = {
        status: exitCode === 0 ? "passed" : "failed",
        exitCode: normalized.exitCode,
        signal: normalized.signal,
        log,
      };

      opts.onProgress?.({
        gate: gate.name,
        status: result.status,
        exitCode: result.exitCode,
        signal: result.signal,
        durationMs: Date.now() - startedAt,
        log,
      });
      resolveGate({ name: gate.name, result });
    };

    try {
      const child = spawn(gate.command, {
        shell: true,
        cwd: repoRoot,
        stdio: ["ignore", fd, fd],
      });

      child.once("error", (error) => finish(null, null, error));
      child.once("close", (code, signal) => finish(code, signal));
    } catch (error) {
      finish(null, null, error);
    }
  });
}

function normalizeSignalExit(exitCode: number | null, signal: string | null): { exitCode: number | null; signal: string | null } {
  if (signal) return { exitCode, signal };
  if (typeof exitCode === "number" && exitCode > 128) {
    const signalNumber = exitCode - 128;
    const signalName = Object.entries(osConstants.signals).find(([, value]) => value === signalNumber)?.[0] ?? null;
    if (signalName) {
      return { exitCode: null, signal: signalName };
    }
  }
  return { exitCode, signal };
}

function publishMeta(lockMetaPath: string, meta: LockMeta): void {
  writeJsonAtomic(lockMetaPath, meta);
}

function writeJsonAtomic(path: string, value: unknown): void {
  const tmp = `${path}.tmp.${process.pid}.${randomHex(3)}`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, path);
}

function readMeta(lockMetaPath: string): MetaRead {
  try {
    const parsed = JSON.parse(readFileSync(lockMetaPath, "utf-8")) as Partial<LockMeta>;
    if (
      typeof parsed.pid === "number" &&
      typeof parsed.runId === "string" &&
      typeof parsed.gateKey === "string" &&
      typeof parsed.startedAt === "number" &&
      (typeof parsed.head === "string" || parsed.head === null) &&
      (typeof parsed.dirty === "boolean" || parsed.dirty === null)
    ) {
      return { kind: "valid", meta: parsed as LockMeta };
    }
    return { kind: "malformed" };
  } catch (error) {
    return errorCode(error) === "ENOENT" || errorCode(error) === "ENOTDIR"
      ? { kind: "missing" }
      : { kind: "malformed" };
  }
}

function readResultIfPresent(path: string): ValidateResult | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as ValidateResult;
  } catch {
    return null;
  }
}

function releaseOwnedLock(lockDir: string, lockMetaPath: string, context: OwnerContext): void {
  const current = readMeta(lockMetaPath);
  if (
    current.kind === "valid" &&
    current.meta.pid === process.pid &&
    current.meta.runId === context.runId &&
    current.meta.gateKey === context.gateKey &&
    current.meta.startedAt === context.startedAt
  ) {
    rmSync(lockDir, { recursive: true, force: true });
  }
}

async function waitForResult(path: string, timeoutMs: number, pollIntervalMs: number): Promise<ValidateResult | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const result = readResultIfPresent(path);
    if (result) return result;
    await sleepWithinDeadline(pollIntervalMs, deadline);
  }
  return null;
}

function captureTreeState(repoRoot: string): TreeState {
  const head = runGit(repoRoot, ["rev-parse", "HEAD"]);
  const dirtyOutput = runGit(repoRoot, ["status", "--porcelain"]);

  return {
    head,
    dirty: dirtyOutput === null ? null : dirtyOutput.length > 0,
  };
}

function runGit(repoRoot: string, args: string[]): string | null {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  if (result.status !== 0) return null;
  return result.stdout.trim();
}

function pidIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errorCode(error) === "EPERM";
  }
}

function createRunId(startedAt: number): string {
  return `${startedAt}-${randomHex(3)}`;
}

function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

function safeLogName(name: string): string {
  return name.replace(/[\\/]/g, "_");
}

function isLockInfrastructureError(code: string | undefined): boolean {
  return code === "EACCES" || code === "EPERM" || code === "EROFS";
}

function isRestoreContentionError(code: string | undefined): boolean {
  return code === "ENOTEMPTY" || code === "EEXIST" || code === "ENOENT";
}

function ownerErrorResult(context: OwnerContext, message: string): ValidateResult {
  const finishedAt = Date.now();
  return {
    ok: false,
    runId: context.runId,
    gateKey: context.gateKey,
    head: context.head,
    dirty: context.dirty,
    latched: false,
    startedAt: context.startedAt,
    finishedAt,
    gates: {},
    errors: [message],
  };
}

function errorResult(gateKey: string, message: string, startedAt: number): ValidateResult {
  const finishedAt = Date.now();
  return {
    ok: false,
    runId: `error-${startedAt}-${randomHex(3)}`,
    gateKey,
    head: null,
    dirty: null,
    latched: false,
    startedAt,
    finishedAt,
    gates: {},
    errors: [message],
  };
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function sleepWithinDeadline(ms: number, deadline: number): Promise<void> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return;
  await sleep(Math.min(ms, remaining));
}
