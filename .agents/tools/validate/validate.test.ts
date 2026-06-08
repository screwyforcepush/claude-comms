import { after, describe, it } from "node:test";
import assert from "node:assert";
import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runValidate, type ValidateConfig, type ValidateResult } from "./validate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const TEMP_ROOTS = new Set<string>();

after(() => {
  for (const root of TEMP_ROOTS) {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // A chmod-restored cleanup retry is handled in individual tests.
    }
  }
});

function tempDir(prefix = "validate-test-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  TEMP_ROOTS.add(dir);
  return dir;
}

function nodeCommand(source: string): string {
  return `${JSON.stringify(process.execPath)} -e ${JSON.stringify(source.replace(/\s*\n\s*/g, " "))}`;
}

function passCommand(): string {
  return nodeCommand("process.exit(0);");
}

function failCommand(code = 3): string {
  return nodeCommand(`process.exit(${code});`);
}

function markerCommand(marker: string, label: string, delayMs = 0, exitCode = 0): string {
  return nodeCommand(`
    const fs = require("fs");
    const marker = ${JSON.stringify(marker)};
    fs.appendFileSync(marker, ${JSON.stringify(`${label}:start`)} + " " + Date.now() + "\\n");
    setTimeout(() => {
      fs.appendFileSync(marker, ${JSON.stringify(`${label}:end`)} + " " + Date.now() + "\\n");
      process.exit(${exitCode});
    }, ${delayMs});
  `);
}

function appendOnceCommand(marker: string, label: string, delayMs = 120): string {
  return nodeCommand(`
    const fs = require("fs");
    fs.appendFileSync(${JSON.stringify(marker)}, ${JSON.stringify(label)} + "\\n");
    setTimeout(() => process.exit(0), ${delayMs});
  `);
}

function baseConfig(logDir: string, gates: ValidateConfig["gates"], overrides: Partial<ValidateConfig> = {}): ValidateConfig {
  return {
    logDir,
    pollIntervalMs: 20,
    metaGraceMs: 60,
    staleLockMs: 5_000,
    timeoutMs: 3_000,
    gates,
    ...overrides,
  };
}

function readLines(file: string): string[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf-8").trim().split("\n").filter(Boolean);
}

async function waitFor(predicate: () => boolean, timeoutMs = 1_000, intervalMs = 10): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, intervalMs));
  }
  assert.ok(predicate(), "condition was not met before timeout");
}

function writeMeta(logDir: string, meta: Record<string, unknown>): void {
  mkdirSync(join(logDir, "lock"), { recursive: true });
  writeFileSync(join(logDir, "lock", "meta.json"), JSON.stringify(meta, null, 2));
}

function latestResult(logDir: string): ValidateResult {
  return JSON.parse(readFileSync(join(logDir, "result.json"), "utf-8")) as ValidateResult;
}

function makeCliFixture(config: ValidateConfig): { dir: string; cliPath: string } {
  const dir = tempDir("validate-cli-");
  copyFileSync(join(__dirname, "cli.ts"), join(dir, "cli.ts"));
  copyFileSync(join(__dirname, "validate.ts"), join(dir, "validate.ts"));
  writeFileSync(join(dir, "config.json"), JSON.stringify(config, null, 2));
  return { dir, cliPath: join(dir, "cli.ts") };
}

function spawnCli(cliPath: string, args: string[] = []) {
  return spawnSync("npx", ["tsx", cliPath, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf-8")) as T;
}

function runProcess(command: string, args: string[], cwd = REPO_ROOT): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (status) => {
      resolveRun({ status, stdout, stderr });
    });
  });
}

describe("runValidate", () => {
  it("T1 rolls up ok solely from child exit codes", async () => {
    const logDir = join(tempDir(), "logs");
    const config = baseConfig(logDir, [
      { name: "pass", command: passCommand() },
      { name: "fail", command: failCommand(3) },
    ]);

    const result = await runValidate(config, { repoRoot: REPO_ROOT });

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.gates.pass.status, "passed");
    assert.strictEqual(result.gates.pass.exitCode, 0);
    assert.strictEqual(result.gates.pass.signal, null);
    assert.strictEqual(result.gates.fail.status, "failed");
    assert.strictEqual(result.gates.fail.exitCode, 3);
    assert.strictEqual(result.gates.fail.signal, null);
    assert.ok(existsSync(result.gates.pass.log));
    assert.ok(existsSync(result.gates.fail.log));

    const allPass = await runValidate(baseConfig(join(tempDir(), "logs"), [
      { name: "one", command: passCommand() },
      { name: "two", command: passCommand() },
    ]), { repoRoot: REPO_ROOT });
    assert.strictEqual(allPass.ok, true);
  });

  it("T1b treats signal-killed gates as failed", async () => {
    const result = await runValidate(baseConfig(join(tempDir(), "logs"), [
      { name: "sigkill", command: nodeCommand("process.kill(process.pid, 'SIGKILL');") },
    ]), { repoRoot: REPO_ROOT });

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.gates.sigkill.status, "failed");
    assert.strictEqual(result.gates.sigkill.exitCode, null);
    assert.ok(result.gates.sigkill.signal);
  });

  it("T2 latches a duplicate concurrent suite without spawning duplicate gates", async () => {
    const root = tempDir();
    const counter = join(root, "counter.txt");
    const config = baseConfig(join(root, "logs"), [
      { name: "slow", command: appendOnceCommand(counter, "owner", 180) },
    ]);

    const [a, b] = await Promise.all([
      runValidate(config, { repoRoot: REPO_ROOT }),
      runValidate(config, { repoRoot: REPO_ROOT }),
    ]);

    assert.deepStrictEqual(readLines(counter), ["owner"]);
    assert.deepStrictEqual([a.latched, b.latched].sort(), [false, true]);

    const owner = a.latched ? b : a;
    const latcher = a.latched ? a : b;
    assert.strictEqual(latcher.runId, owner.runId);
    assert.strictEqual(latcher.gateKey, owner.gateKey);
    assert.strictEqual(latcher.head, owner.head);
    assert.strictEqual(latcher.startedAt, owner.startedAt);
    assert.strictEqual(latcher.ok, owner.ok);
  });

  it("T3 runs only an exact --gates subset and stamps the sorted gateKey", async () => {
    const root = tempDir();
    const marker = join(root, "marker.txt");
    const config = baseConfig(join(root, "logs"), [
      { name: "lint", command: markerCommand(marker, "lint") },
      { name: "test", command: markerCommand(marker, "test") },
      { name: "build", command: markerCommand(marker, "build") },
      { name: "ts:check", command: markerCommand(marker, "tscheck") },
    ]);

    const result = await runValidate(config, { gates: ["lint"], repoRoot: REPO_ROOT });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.gateKey, "lint");
    assert.deepStrictEqual(Object.keys(result.gates), ["lint"]);
    assert.deepStrictEqual(readLines(marker).map((line) => line.split(" ")[0]), ["lint:start", "lint:end"]);
  });

  it("T5 reaps a stale lock owned by a dead pid", async () => {
    const root = tempDir();
    const logDir = join(root, "logs");
    writeMeta(logDir, {
      pid: 999_999_999,
      runId: "dead-owner",
      gateKey: "lint",
      head: null,
      dirty: null,
      startedAt: Date.now(),
    });

    const result = await runValidate(baseConfig(logDir, [
      { name: "lint", command: passCommand() },
    ]), { gates: ["lint"], repoRoot: REPO_ROOT });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.latched, false);
    assert.notStrictEqual(result.runId, "dead-owner");
    assert.ok(!existsSync(join(logDir, "lock")));
  });

  it("T6 reaps a stale lock by age even when the pid looks alive", async () => {
    const root = tempDir();
    const logDir = join(root, "logs");
    const staleLockMs = 80;
    writeMeta(logDir, {
      pid: process.pid,
      runId: "aged-owner",
      gateKey: "lint",
      head: null,
      dirty: null,
      startedAt: Date.now() - staleLockMs - 100,
    });

    const result = await runValidate(baseConfig(logDir, [
      { name: "lint", command: passCommand() },
    ], { staleLockMs }), { gates: ["lint"], repoRoot: REPO_ROOT });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.latched, false);
    assert.notStrictEqual(result.runId, "aged-owner");
  });

  it("T7 gracefully handles no-git repo roots and lock creation failures", async () => {
    const nonGitRoot = tempDir("validate-nongit-");
    const nonGit = await runValidate(baseConfig(join(tempDir(), "logs"), [
      { name: "pass", command: passCommand() },
    ]), { repoRoot: nonGitRoot });

    assert.strictEqual(nonGit.ok, true);
    assert.strictEqual(nonGit.head, null);
    assert.strictEqual(nonGit.dirty, null);

    const root = tempDir();
    const logDir = join(root, "readonly-logdir");
    const runsDir = join(logDir, "runs");
    mkdirSync(runsDir, { recursive: true, mode: 0o777 });
    chmodSync(logDir, 0o555);
    const warnings: string[] = [];

    try {
      const fallback = await runValidate(baseConfig(logDir, [
        { name: "pass", command: passCommand() },
      ]), {
        repoRoot: REPO_ROOT,
        onWarning: (message) => warnings.push(message),
      });

      assert.strictEqual(fallback.ok, true);
      assert.strictEqual(fallback.latched, false);
      assert.match(fallback.runId, /^unlatched-/);
      assert.match(fallback.gates.pass.log, new RegExp(`unlatched-${process.pid}`));
      assert.ok(warnings.some((message) => message.includes("unlatched")));
    } finally {
      chmodSync(logDir, 0o755);
    }
  });

  it("T8 serializes a two-reaper stale-lock race so only one contender runs", async () => {
    const root = tempDir();
    const logDir = join(root, "logs");
    const counter = join(root, "counter.txt");
    const configPath = join(root, "config.json");
    const readyPath = join(root, "ready.txt");
    const goPath = join(root, "go");
    const runnerPath = join(root, "runner.ts");
    const outPrefix = join(root, "result");
    writeMeta(logDir, {
      pid: 999_999_999,
      runId: "stale-owner",
      gateKey: "slow",
      head: null,
      dirty: null,
      startedAt: Date.now() - 10_000,
    });

    const config = baseConfig(logDir, [
      { name: "slow", command: appendOnceCommand(counter, "run", 180) },
    ], { staleLockMs: 1_000 });
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    writeFileSync(runnerPath, `
      import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
      import { pathToFileURL } from "node:url";
      async function main() {
        const [validatePath, configPath, repoRoot, readyPath, goPath, outPrefix, id] = process.argv.slice(2);
        const { runValidate } = await import(pathToFileURL(validatePath).href);
        appendFileSync(readyPath, id + "\\n");
        while (!existsSync(goPath)) {
          await new Promise((resolveWait) => setTimeout(resolveWait, 5));
        }
        const config = JSON.parse(readFileSync(configPath, "utf-8"));
        const result = await runValidate(config, { repoRoot });
        writeFileSync(outPrefix + "." + id + ".json", JSON.stringify(result, null, 2));
      }
      main().catch((error) => {
        console.error(error);
        process.exit(1);
      });
    `);

    const validatePath = join(__dirname, "validate.ts");
    const first = runProcess("npx", ["--yes", "tsx", runnerPath, validatePath, configPath, REPO_ROOT, readyPath, goPath, outPrefix, "a"]);
    const second = runProcess("npx", ["--yes", "tsx", runnerPath, validatePath, configPath, REPO_ROOT, readyPath, goPath, outPrefix, "b"]);
    await waitFor(() => readLines(readyPath).length === 2, 15_000);
    writeFileSync(goPath, "go");
    const [firstProcess, secondProcess] = await Promise.all([first, second]);

    assert.strictEqual(firstProcess.status, 0, firstProcess.stderr);
    assert.strictEqual(secondProcess.status, 0, secondProcess.stderr);
    const a = readJson<ValidateResult>(`${outPrefix}.a.json`);
    const b = readJson<ValidateResult>(`${outPrefix}.b.json`);

    assert.deepStrictEqual(readLines(counter), ["run"]);
    assert.deepStrictEqual([a.latched, b.latched].sort(), [false, true]);
    assert.strictEqual(a.runId, b.runId);
  });

  it("does not let a stale owner release a replacement owner's live lock", async () => {
    const root = tempDir();
    const logDir = join(root, "logs");
    const marker = join(root, "marker.txt");
    const config = baseConfig(logDir, [
      { name: "slow", command: markerCommand(marker, "run", 240) },
    ], {
      pollIntervalMs: 10,
      staleLockMs: 70,
      timeoutMs: 2_000,
    });

    const staleOwner = runValidate(config, { repoRoot: REPO_ROOT });
    await waitFor(() => existsSync(join(logDir, "lock", "meta.json")));
    const staleOwnerRunId = readJson<{ runId: string }>(join(logDir, "lock", "meta.json")).runId;
    await sleep(100);

    const replacementOwner = runValidate(config, { repoRoot: REPO_ROOT });
    await waitFor(() => {
      const metaPath = join(logDir, "lock", "meta.json");
      if (!existsSync(metaPath)) return false;
      return readJson<{ runId: string }>(metaPath).runId !== staleOwnerRunId;
    });
    const replacementRunId = readJson<{ runId: string }>(join(logDir, "lock", "meta.json")).runId;

    await waitFor(() => readLines(marker).filter((line) => line.startsWith("run:end")).length >= 1);

    assert.ok(existsSync(join(logDir, "lock", "meta.json")), "replacement owner lock should survive stale owner release");
    assert.strictEqual(readJson<{ runId: string }>(join(logDir, "lock", "meta.json")).runId, replacementRunId);

    const [staleResult, replacementResult] = await Promise.all([staleOwner, replacementOwner]);
    assert.strictEqual(staleResult.runId, staleOwnerRunId);
    assert.strictEqual(replacementResult.runId, replacementRunId);
    assert.notStrictEqual(staleResult.runId, replacementResult.runId);
    assert.ok(!existsSync(join(logDir, "lock")));
  });

  it("T9 abandons a latch when the owner dies without publishing and then re-contends", async () => {
    const root = tempDir();
    const logDir = join(root, "logs");
    const marker = join(root, "marker.txt");
    writeMeta(logDir, {
      pid: process.pid,
      runId: "ghost-owner",
      gateKey: "lint",
      head: null,
      dirty: null,
      startedAt: Date.now(),
    });

    const resultPromise = runValidate(baseConfig(logDir, [
      { name: "lint", command: markerCommand(marker, "lint") },
    ], { timeoutMs: 1_500 }), { gates: ["lint"], repoRoot: REPO_ROOT });

    setTimeout(() => {
      rmSync(join(logDir, "lock"), { recursive: true, force: true });
    }, 100);

    const result = await resultPromise;

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.latched, false);
    assert.notStrictEqual(result.runId, "ghost-owner");
    assert.deepStrictEqual(readLines(marker).map((line) => line.split(" ")[0]), ["lint:start", "lint:end"]);
  });

  it("T10 queues instead of cross-latching when gate sets differ", async () => {
    const root = tempDir();
    const logDir = join(root, "logs");
    const marker = join(root, "marker.txt");
    const config = baseConfig(logDir, [
      { name: "lint", command: markerCommand(marker, "all-lint", 160) },
      { name: "test", command: markerCommand(marker, "all-test", 160) },
    ]);

    const allRun = runValidate(config, { repoRoot: REPO_ROOT });
    await waitFor(() => existsSync(join(logDir, "lock", "meta.json")));
    const subsetRun = runValidate(config, { gates: ["lint"], repoRoot: REPO_ROOT });
    const [allResult, subsetResult] = await Promise.all([allRun, subsetRun]);

    assert.strictEqual(allResult.latched, false);
    assert.strictEqual(subsetResult.latched, false);
    assert.notStrictEqual(allResult.runId, subsetResult.runId);
    assert.strictEqual(allResult.gateKey, "lint,test");
    assert.strictEqual(subsetResult.gateKey, "lint");
    assert.strictEqual(readLines(marker).filter((line) => line.startsWith("all-lint:start")).length, 2);

    const reverseRoot = tempDir();
    const reverseLogDir = join(reverseRoot, "logs");
    const reverseMarker = join(reverseRoot, "marker.txt");
    const reverseConfig = baseConfig(reverseLogDir, [
      { name: "lint", command: markerCommand(reverseMarker, "lint", 160) },
      { name: "test", command: markerCommand(reverseMarker, "test", 160) },
    ]);

    const subsetOwner = runValidate(reverseConfig, { gates: ["lint"], repoRoot: REPO_ROOT });
    await waitFor(() => existsSync(join(reverseLogDir, "lock", "meta.json")));
    const allContender = runValidate(reverseConfig, { repoRoot: REPO_ROOT });
    const [subsetOwnerResult, allContenderResult] = await Promise.all([subsetOwner, allContender]);

    assert.strictEqual(subsetOwnerResult.latched, false);
    assert.strictEqual(allContenderResult.latched, false);
    assert.notStrictEqual(subsetOwnerResult.runId, allContenderResult.runId);
    assert.strictEqual(subsetOwnerResult.gateKey, "lint");
    assert.strictEqual(allContenderResult.gateKey, "lint,test");
  });

  it("T11 keeps run-scoped result and log artifacts immutable across later runs", async () => {
    const root = tempDir();
    const logDir = join(root, "logs");
    const config = baseConfig(logDir, [
      { name: "lint", command: nodeCommand("console.log('lint output'); process.exit(0);") },
    ]);

    const first = await runValidate(config, { repoRoot: REPO_ROOT });
    const firstResultPath = join(logDir, "runs", first.runId, "result.json");
    const firstResultBytes = readFileSync(firstResultPath, "utf-8");
    const firstLogBytes = readFileSync(first.gates.lint.log, "utf-8");

    const second = await runValidate(config, { repoRoot: REPO_ROOT });

    assert.notStrictEqual(second.runId, first.runId);
    assert.strictEqual(readFileSync(firstResultPath, "utf-8"), firstResultBytes);
    assert.strictEqual(readFileSync(first.gates.lint.log, "utf-8"), firstLogBytes);
    assert.deepStrictEqual(latestResult(logDir).runId, second.runId);
  });
});

describe("cli.ts", () => {
  it("T4 --status emits the latest result without spawning gates and reports none when absent", () => {
    const root = tempDir();
    const logDir = join(root, "logs");
    const marker = join(root, "marker.txt");
    mkdirSync(logDir, { recursive: true });
    const prior = {
      ok: false,
      runId: "prior-run",
      gateKey: "lint",
      head: null,
      dirty: null,
      latched: false,
      startedAt: 1,
      finishedAt: 2,
      gates: {
        lint: { status: "failed", exitCode: 7, signal: null, log: "/tmp/lint.log" },
      },
    };
    writeFileSync(join(logDir, "result.json"), JSON.stringify(prior, null, 2));
    const { cliPath } = makeCliFixture(baseConfig(logDir, [
      { name: "lint", command: markerCommand(marker, "should-not-run") },
    ]));

    const status = spawnCli(cliPath, ["--status"]);

    assert.strictEqual(status.status, 0, status.stderr);
    assert.deepStrictEqual(JSON.parse(status.stdout), prior);
    assert.ok(!existsSync(marker));

    const none = makeCliFixture(baseConfig(join(tempDir(), "missing-logs"), [
      { name: "lint", command: markerCommand(marker, "should-not-run") },
    ]));
    const noStatus = spawnCli(none.cliPath, ["--status"]);
    assert.strictEqual(noStatus.status, 0, noStatus.stderr);
    assert.deepStrictEqual(JSON.parse(noStatus.stdout), { status: "none" });
  });

  it("T12 --help prints interface and configured gates without taking the lock", () => {
    const logDir = join(tempDir(), "logs");
    const { cliPath } = makeCliFixture(baseConfig(logDir, [
      { name: "lint", command: passCommand() },
      { name: "test", command: passCommand() },
    ]));

    const result = spawnCli(cliPath, ["--help"]);
    const output = `${result.stdout}${result.stderr}`;

    assert.strictEqual(result.status, 0, result.stderr);
    assert.match(output, /Usage:/);
    assert.match(output, /--gates lint,test/);
    assert.match(output, /lint/);
    assert.match(output, /test/);
    assert.ok(!existsSync(join(logDir, "lock")));
  });

  it("T13 runs all default gates concurrently, blocks, emits one JSON document, and exits from ok", () => {
    const root = tempDir();
    const logDir = join(root, "logs");
    const marker = join(root, "marker.txt");
    const { cliPath } = makeCliFixture(baseConfig(logDir, [
      { name: "a", command: markerCommand(marker, "a", 260) },
      { name: "b", command: markerCommand(marker, "b", 260) },
      { name: "c", command: markerCommand(marker, "c", 260) },
    ]));

    const startedAt = Date.now();
    const result = spawnCli(cliPath);
    const elapsedMs = Date.now() - startedAt;
    const parsed = JSON.parse(result.stdout) as ValidateResult;
    const lines = readLines(marker);
    const starts = lines.filter((line) => line.includes(":start"));
    const ends = lines.filter((line) => line.includes(":end"));
    const lastStart = Math.max(...starts.map((line) => Number(line.split(" ")[1])));
    const firstEnd = Math.min(...ends.map((line) => Number(line.split(" ")[1])));

    assert.strictEqual(result.status, 0, result.stderr);
    assert.strictEqual(parsed.ok, true);
    assert.deepStrictEqual(Object.keys(parsed.gates), ["a", "b", "c"]);
    assert.strictEqual(starts.length, 3);
    assert.strictEqual(ends.length, 3);
    assert.ok(lastStart < firstEnd, "all gate processes should start before any finishes");
    assert.ok(elapsedMs >= 240, "CLI should block until the slowest gate completes");
    assert.match(result.stderr, /pass a/);

    const failing = makeCliFixture(baseConfig(join(tempDir(), "logs"), [
      { name: "pass", command: passCommand() },
      { name: "fail", command: failCommand(9) },
    ]));
    const failed = spawnCli(failing.cliPath);
    const failedJson = JSON.parse(failed.stdout) as ValidateResult;

    assert.strictEqual(failed.status, 1);
    assert.strictEqual(failedJson.ok, false);
    assert.strictEqual(failedJson.gates.fail.exitCode, 9);
  });

  it("rejects an empty --gates list instead of falling back to all gates", () => {
    const logDir = join(tempDir(), "logs");
    const { cliPath } = makeCliFixture(baseConfig(logDir, [
      { name: "lint", command: passCommand() },
    ]));

    const result = spawnCli(cliPath, ["--gates", ","]);

    assert.strictEqual(result.status, 1);
    assert.strictEqual(result.stdout, "");
    assert.match(result.stderr, /requires at least one gate name/);
    assert.ok(!existsSync(join(logDir, "lock")));
  });
});
