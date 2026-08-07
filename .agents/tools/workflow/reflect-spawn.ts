#!/usr/bin/env npx tsx
import { spawn, ChildProcess } from "child_process";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { getEngineIdentity } from "./lib/engine-version.js";
import { buildAgyCommand } from "./lib/streams.js";

const DEFAULT_REFLECTION_TIMEOUT_MS = 5 * 60_000;
const KILL_GRACE_MS = 10_000;

const api = anyApi;
const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "config.json");
const templatePath = join(__dirname, "templates", "reflect.md");
const projectRoot = join(__dirname, "..", "..", "..");

interface Config {
  convexUrl: string;
  password: string;
  reflectionTimeoutMs?: number;
}

type ReflectableHarness = "claude" | "codex" | "gemini";

function debug(message: string): void {
  if (process.env.REFLECT_DEBUG) {
    console.error(`[reflect-spawn] ${message}`);
  }
}

function render(template: string, replacements: Record<string, string>): string {
  let output = template;
  for (const [key, value] of Object.entries(replacements)) {
    output = output.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return output;
}

function terminate(child: ChildProcess): void {
  if (child.exitCode !== null || child.killed) return;
  child.kill("SIGTERM");
  setTimeout(() => {
    if (child.exitCode === null && !child.killed) {
      child.kill("SIGKILL");
    }
  }, KILL_GRACE_MS).unref();
}

async function runWithTimeout(
  command: string,
  args: string[],
  timeoutMs: number,
  promptStdin: string
): Promise<void> {
  await new Promise<void>((resolve) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: ["pipe", "ignore", "ignore"],
    });

    // Prompt goes via stdin, not argv. Error handler must be attached before
    // end(): a child that dies without draining stdin emits EPIPE here.
    child.stdin?.on("error", (err) => {
      debug(`stdin write failed: ${err.message}`);
    });
    child.stdin?.end(promptStdin, "utf-8");

    const timeout = setTimeout(() => {
      debug(`timeout after ${timeoutMs}ms`);
      terminate(child);
    }, timeoutMs);
    timeout.unref();

    child.on("error", (err) => {
      debug(`spawn error: ${err.message}`);
      clearTimeout(timeout);
      resolve();
    });
    child.on("close", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function runClaude(prompt: string, sessionId: string, timeoutMs: number, model?: string): Promise<void> {
  const args = [
    "--dangerously-skip-permissions",
    "--verbose",
    "--output-format",
    "stream-json",
    "--disable-slash-commands",
  ];
  if (model) {
    args.push("--model", model);
  }
  args.push("--resume", sessionId, "--fork-session", "-p");
  await runWithTimeout("claude", args, timeoutMs, prompt);
}

async function runCodex(prompt: string, sessionId: string, timeoutMs: number, model?: string): Promise<void> {
  const args = ["--yolo", "e", "resume"];
  if (model) {
    args.push("-m", model);
  }
  args.push(sessionId, "-", "--json");
  await runWithTimeout("codex", args, timeoutMs, prompt);
}

async function runAgy(prompt: string, sessionId: string, timeoutMs: number, model?: string): Promise<void> {
  const command = buildAgyCommand({
    sessionId,
    model,
    printTimeoutMs: timeoutMs,
  });
  await runWithTimeout(command.cmd, command.args, timeoutMs, prompt);
}

async function runReflectionHarness(
  harness: ReflectableHarness,
  prompt: string,
  sessionId: string,
  timeoutMs: number,
  model?: string
): Promise<void> {
  if (harness === "claude") {
    await runClaude(prompt, sessionId, timeoutMs, model);
  } else if (harness === "codex") {
    await runCodex(prompt, sessionId, timeoutMs, model);
  } else {
    // The gemini CLI backend is gone; harness "gemini" now always means agy.
    await runAgy(prompt, sessionId, timeoutMs, model);
  }
}

async function main(): Promise<void> {
  const jobId = process.argv[2];
  if (!jobId) return;

  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as Config;
    const client = new ConvexHttpClient(config.convexUrl);
    const jobData = await client.query(api.jobs.getWithGroup, {
      password: config.password,
      id: jobId as any,
    });

    if (!jobData) return;
    if (jobData.status !== "complete" && jobData.status !== "failed") return;
    if (jobData.status === "awaiting_retry") return;
    if (
      jobData.harness !== "claude" &&
      jobData.harness !== "codex" &&
      jobData.harness !== "gemini"
    ) return;
    if (!jobData.sessionId) return;
    if (!jobData.namespaceId) return;

    const engineIdentity = getEngineIdentity();
    try {
      const decision = await client.mutation(api.reflectionsV2.shouldReflect, {
        password: config.password,
        jobId: jobId as any,
        engineVersion: engineIdentity.engineVersion,
      });
      if (decision?.shouldReflect === false) {
        debug(`reflection disabled for job ${jobId}`);
        return;
      }
    } catch (err) {
      debug(`shouldReflect failed open: ${(err as Error).message}`);
    }

    const northStar = typeof jobData.assignment?.northStar === "string"
      ? jobData.assignment.northStar
      : "";
    const template = readFileSync(templatePath, "utf-8");
    const prompt = render(template, {
      JOB_TYPE: jobData.jobType,
      JOB_STATUS: jobData.status,
      JOB_ID: jobData._id,
      ASSIGNMENT_SCOPE_HINT: northStar.slice(0, 200),
    });

    const model = typeof jobData.model === "string" ? jobData.model : undefined;
    await runReflectionHarness(
      jobData.harness,
      prompt,
      jobData.sessionId,
      config.reflectionTimeoutMs ?? DEFAULT_REFLECTION_TIMEOUT_MS,
      model
    );
  } catch (err) {
    debug((err as Error).message);
  }
}

main();
