#!/usr/bin/env npx tsx
/**
 * Watch for pending feedback using Convex real-time subscriptions.
 * Runs a command for each pending feedback item (non-blocking).
 *
 * Uses WebSocket subscription - no polling, instant updates.
 * Triggers on startup for existing pending items, plus any new ones.
 *
 * CONFIG FILE:
 *   Place config.json in the same directory with:
 *   {
 *     "convexUrl": "https://foo.convex.cloud",
 *     "project": "my-project",
 *     "command": "claude -p \"respond hello world\"",
 *     "password": "optional-shared-secret"
 *   }
 *
 * USAGE:
 *   npx tsx watch-feedback.ts [convex_url] [project] [command] [password]
 *
 * STANDALONE (no npm install needed):
 *   node watch-feedback-standalone.cjs [convex_url] [project] [command] [password]
 *
 * ARGUMENTS (override config file values):
 *   convex_url  - Convex deployment URL (e.g., https://foo.convex.cloud)
 *   project     - Project name to filter feedback
 *   command     - Shell command to run (default: claude -p "respond hello world")
 *                 The feedback ID is appended as an argument.
 *   password    - Optional shared secret; command runs only when present in note
 *
 * EXAMPLES:
 *   npx tsx watch-feedback.ts                                    # uses config.json
 *   npx tsx watch-feedback.ts https://foo.convex.cloud my-project
 *   npx tsx watch-feedback.ts https://foo.convex.cloud my-project "echo"
 *   npx tsx watch-feedback.ts https://foo.convex.cloud my-project "echo" "secret"
 *
 * OUTPUT:
 *   received new feedback <id>
 *   delegated feedback <id> to PID: <pid>
 */

import { spawn } from "child_process";
import { ConvexClient } from "convex/browser";
import { anyApi } from "convex/server";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { ConnectionState } from "convex/browser";

// Load config file from same directory as script
interface Config {
  convexUrl?: string;
  project?: string;
  command?: string;
  password?: string;
}

let config: Config = {};
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const configPath = join(__dirname, "config.json");
  config = JSON.parse(readFileSync(configPath, "utf-8"));
} catch {
  // Config file not found or invalid - that's okay, CLI args can provide values
}

// CLI args override config file values
const CONVEX_URL = process.argv[2] || config.convexUrl;
const PROJECT = process.argv[3] || config.project;
const COMMAND = process.argv[4] || config.command || 'claude -p "respond hello world"';
const PASSWORD = process.argv[5] || config.password;
const DISCONNECT_RESTART_MS = 60_000; // restart if WS disconnected for >60s
const RESTART_DELAY_MS = 1_000;

if (!CONVEX_URL || !PROJECT) {
  console.error(
    "Usage: npx tsx watch-feedback.ts [convex_url] [project] [command]"
  );
  console.error(
    "  Or configure via config.json in the same directory"
  );
  console.error(
    "Example: npx tsx watch-feedback.ts https://foo.convex.cloud my-project"
  );
  process.exit(2);
}

let client: ConvexClient | null = null;
let unsubscribeFeedback: (() => void) | null = null;
let unsubscribeConnection: (() => void) | null = null;
let lastConnectedAt = Date.now();
const processedIds = new Set<string>();

function cleanup() {
  unsubscribeFeedback?.();
  unsubscribeConnection?.();
  unsubscribeFeedback = null;
  unsubscribeConnection = null;
  client?.close();
  client = null;
}

function scheduleRestart(reason: string) {
  console.error(`Restarting watcher (${reason})...`);
  cleanup();
  setTimeout(startWatcher, RESTART_DELAY_MS);
}

function startWatcher() {
  console.log(`Watching for feedback on project '${PROJECT}'...`);
  console.log(`Command: ${COMMAND}`);

  client = new ConvexClient(CONVEX_URL);
  lastConnectedAt = Date.now();

  unsubscribeConnection = client.subscribeToConnectionState(
    (state: ConnectionState) => {
      if (state.isWebSocketConnected) {
        lastConnectedAt = Date.now();
        return;
      }
      if (Date.now() - lastConnectedAt > DISCONNECT_RESTART_MS) {
        scheduleRestart("websocket disconnected too long");
      }
    }
  );
  unsubscribeFeedback = client.onUpdate(
    anyApi.feedback.listByStatus,
    { status: "pending", project: PROJECT },
    (results: any[]) => {
      for (const feedback of results ?? []) {
        const id = feedback?._id;
        if (!id || processedIds.has(id)) continue;

        processedIds.add(id);

        if (shouldRunForFeedback(feedback)) {
          runCommand(id);
        } else {
          console.log(`skipping feedback ${id}: password not found in note`);
        }
      }
    },
    (error: Error) => {
      console.error("Subscription error:", error.message);
      scheduleRestart("subscription error");
    }
  );
}

function shouldRunForFeedback(feedback: any) {
  if (!PASSWORD) return true;
  const note = typeof feedback?.note === "string" ? feedback.note : "";
  return note.includes(PASSWORD);
}

function runCommand(feedbackId: string) {
  console.log(`received new feedback ${feedbackId}`);

  const userShell = process.env.SHELL || "/bin/zsh";
  const fullCommand = COMMAND.includes("{id}")
    ? COMMAND.replace(/\{id\}/g, feedbackId)
    : `${COMMAND} ${feedbackId}`;

  const env = { ...process.env };
  let args: string[];

  if (userShell.includes("zsh")) {
    // zsh: force interactive so PATH/aliases from user config are available (Mac default)
    args = ["-ic", fullCommand];
  } else if (userShell.includes("bash")) {
    // Bash: use login shell and force .bashrc via BASH_ENV to avoid job-control noise
    env.BASH_ENV = `${process.env.HOME}/.bashrc`;
    args = ["-lc", fullCommand];
  } else {
    // Fallback: plain POSIX sh
    args = ["-c", fullCommand];
  }

  const child = spawn(userShell, args, {
    detached: true,
    stdio: "inherit",
    env,
  });

  child.on("error", (err) => {
    console.error(`failed to start command for ${feedbackId}:`, err.message);
  });

  console.log(`delegated feedback ${feedbackId} to PID: ${child.pid}`);

  // Don't wait for it - let it run independently
  child.unref();
}

startWatcher();

// Cleanup on exit
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  cleanup();
  process.exit(0);
});

// Keep process alive
setInterval(() => {}, 1000);
