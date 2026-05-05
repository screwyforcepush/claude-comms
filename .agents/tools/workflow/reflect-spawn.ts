#!/usr/bin/env npx tsx
import { spawn, ChildProcess } from "child_process";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

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

async function runClaude(prompt: string, sessionId: string, timeoutMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    const child = spawn(
      "claude",
      [
        "--dangerously-skip-permissions",
        "--verbose",
        "--output-format",
        "stream-json",
        "--disable-slash-commands",
        "--resume",
        sessionId,
        "--fork-session",
        "-p",
        prompt,
      ],
      {
        cwd: projectRoot,
        env: process.env,
        stdio: "ignore",
      }
    );

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
    if (jobData.harness !== "claude") return;
    if (!jobData.sessionId) return;
    if (!jobData.namespaceId) return;

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

    await runClaude(
      prompt,
      jobData.sessionId,
      config.reflectionTimeoutMs ?? DEFAULT_REFLECTION_TIMEOUT_MS
    );
  } catch (err) {
    debug((err as Error).message);
  }
}

main();
