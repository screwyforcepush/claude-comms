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
 *     "command": "claude -p \"respond hello world\""
 *   }
 *
 * USAGE:
 *   npx tsx watch-feedback.ts [convex_url] [project] [command]
 *
 * STANDALONE (no npm install needed):
 *   node watch-feedback-standalone.cjs [convex_url] [project] [command]
 *
 * ARGUMENTS (override config file values):
 *   convex_url  - Convex deployment URL (e.g., https://foo.convex.cloud)
 *   project     - Project name to filter feedback
 *   command     - Shell command to run (default: claude -p "respond hello world")
 *                 The feedback ID is appended as an argument.
 *
 * EXAMPLES:
 *   npx tsx watch-feedback.ts                                    # uses config.json
 *   npx tsx watch-feedback.ts https://foo.convex.cloud my-project
 *   npx tsx watch-feedback.ts https://foo.convex.cloud my-project "echo"
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

// Load config file from same directory as script
interface Config {
  convexUrl?: string;
  project?: string;
  command?: string;
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

const client = new ConvexClient(CONVEX_URL);

let previousIds = new Set<string>();

console.log(`Watching for feedback on project '${PROJECT}'...`);
console.log(`Command: ${COMMAND}`);

function runCommand(feedbackId: string) {
  console.log(`received new feedback ${feedbackId}`);

  // Use user's shell with -i (interactive) to source profile (aliases, PATH)
  const userShell = process.env.SHELL || "/bin/sh";
  // Support {id} placeholder, otherwise append ID at end
  const fullCommand = COMMAND.includes("{id}")
    ? COMMAND.replace(/\{id\}/g, feedbackId)
    : `${COMMAND} ${feedbackId}`;

  const child = spawn(userShell, ["-ic", fullCommand], {
    detached: true,
    stdio: "inherit",
    env: process.env,
  });

  child.on("error", (err) => {
    console.error(`failed to start command for ${feedbackId}:`, err.message);
  });

  console.log(`delegated feedback ${feedbackId} to PID: ${child.pid}`);

  // Don't wait for it - let it run independently
  child.unref();
}

// Subscribe to pending feedback
const unsubscribe = client.onUpdate(
  anyApi.feedback.listByStatus,
  { status: "pending", project: PROJECT },
  (results: any[]) => {
    const currentIds = new Set(results?.map((r: any) => r._id) ?? []);

    // Trigger for any ID we haven't seen before (including initial load)
    for (const id of currentIds) {
      if (!previousIds.has(id)) {
        runCommand(id);
      }
    }

    previousIds = currentIds;
  },
  (error: Error) => {
    console.error("Subscription error:", error.message);
  }
);

// Cleanup on exit
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  unsubscribe();
  client.close();
  process.exit(0);
});

// Keep process alive
setInterval(() => {}, 1000);
