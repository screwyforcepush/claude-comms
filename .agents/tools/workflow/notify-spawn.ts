#!/usr/bin/env npx tsx
import { spawn, ChildProcess } from "child_process";
import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { buildClaudeForkArgs } from "./lib/fork-args.js";

const DEFAULT_NOTIFY_TIMEOUT_MS = 5 * 60_000;
const KILL_GRACE_MS = 10_000;

const api = anyApi;
const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "config.json");
const templatePath = join(__dirname, "templates", "notify.md");
const projectRoot = join(__dirname, "..", "..", "..");

interface Config {
  convexUrl: string;
  password: string;
  notifyTimeoutMs?: number;
}

const NOTIFY_DISALLOWED_TOOLS = [
  "AskUserQuestion",
  "Task",
  "Read",
  "Glob",
  "Grep",
  "LS",
  "Edit",
  "MultiEdit",
  "Write",
  "NotebookEdit",
  "TodoWrite",
  "WebFetch",
  "WebSearch",
  "PushNotification",
  "RemoteTrigger",
  "Workflow",
  "ScheduleWakeup",
  "mcp__claude_ai_Gmail__authenticate",
  "mcp__claude_ai_Gmail__complete_authentication",
  "mcp__claude_ai_Google_Calendar__authenticate",
  "mcp__claude_ai_Google_Calendar__complete_authentication",
  "mcp__claude_ai_Google_Drive__authenticate",
  "mcp__claude_ai_Google_Drive__complete_authentication",
];

function debug(message: string): void {
  if (process.env.NOTIFY_DEBUG) {
    console.error(`[notify-spawn] ${message}`);
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

function buildNotifyClaudeForkArgs(sessionId: string): string[] {
  const args = buildClaudeForkArgs({ sessionId });
  const resumeIndex = args.indexOf("--resume");
  args.splice(resumeIndex, 0, "--disallowedTools", ...NOTIFY_DISALLOWED_TOOLS);
  return args;
}

function bodyPath(threadId: string): string {
  const rand = randomBytes(8).toString("hex");
  return `/tmp/notify-${threadId}-${process.pid}-${rand}.txt`;
}

async function main(): Promise<void> {
  const threadId = process.argv[2];
  const sessionId = process.argv[3];
  if (!threadId || !sessionId) return;

  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as Config;
    const client = new ConvexHttpClient(config.convexUrl);

    let enabled = false;
    try {
      enabled = await client.query(api.settings.getAudioNotifications, {
        password: config.password,
      });
    } catch (err) {
      debug(`getAudioNotifications failed closed: ${(err as Error).message}`);
      return;
    }
    if (enabled !== true) return;

    const template = readFileSync(templatePath, "utf-8");
    const prompt = render(template, {
      THREAD_ID: threadId,
      BODY_PATH: bodyPath(threadId),
    });

    await runWithTimeout(
      "claude",
      buildNotifyClaudeForkArgs(sessionId),
      config.notifyTimeoutMs ?? DEFAULT_NOTIFY_TIMEOUT_MS,
      prompt
    );
  } catch (err) {
    debug((err as Error).message);
  }
}

main();
