#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function usage(exitCode = 0) {
  const out = exitCode === 0 ? console.log : console.error;
  out(`Usage:
  agent-comms [--group <groupId>] [--name <name>] [--json] sync [--after <position>] [--limit <n>]
  agent-comms [--group <groupId>] [--name <name>] [--json] post [--sync] <message...>

Examples:
  ./.agents/tools/workflow/agent-comms.mjs sync
  ./.agents/tools/workflow/agent-comms.mjs post "Root job status"
  ./.agents/tools/workflow/agent-comms.mjs --name agent-a sync
  ./.agents/tools/workflow/agent-comms.mjs --name agent-a post "Found the shared helper"
  ./.agents/tools/workflow/agent-comms.mjs --name agent-a post --sync "Posted and catching up"

Defaults:
  Convex URL: .agents/tools/workflow/config.json, or AGENT_COMMS_CONVEX_URL
  group:      AGENT_COMMS_GROUP, or WORKFLOW_GROUP_ID
  name:       --name, or AGENT_COMMS_INSTANCE
  root name:  WORKFLOW_JOB_ID when no name is provided
  namespace:  WORKFLOW_JOB_ID prefixes provided names when set

For subagents, pass a unique --name on every command.
The CLI saves cursor position locally per group+instance, so --after is only needed to override/reset.
sync catches up on unread peer messages and advances the cursor. post only publishes unless --sync is set.
Flags may appear before or after the command, but message text must be last.`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const options = {
    command: undefined,
    groupId: undefined,
    instance: undefined,
    after: 0,
    afterProvided: false,
    limit: undefined,
    url: undefined,
    json: false,
    syncAfterPost: false,
    messageParts: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--group" || arg === "-g") {
      options.groupId = readOptionValue(argv, ++i, arg);
    } else if (arg === "--name" || arg === "-n" || arg === "--instance" || arg === "-i") {
      options.instance = readOptionValue(argv, ++i, arg);
    } else if (arg === "--after" || arg === "-a") {
      options.after = Number(readOptionValue(argv, ++i, arg));
      options.afterProvided = true;
    } else if (arg === "--limit" || arg === "-l") {
      options.limit = Number(readOptionValue(argv, ++i, arg));
    } else if (arg === "--url") {
      options.url = readOptionValue(argv, ++i, arg);
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--sync") {
      options.syncAfterPost = true;
    } else if (arg === "--help" || arg === "-h") {
      usage(0);
    } else if (arg === "sync" || arg === "post") {
      if (options.command) {
        throw new Error(`Command already set to ${options.command}`);
      }
      options.command = arg;
    } else if (arg?.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      options.messageParts.push(arg, ...argv.slice(i + 1));
      break;
    }
  }

  if (!options.command) {
    usage(1);
  }

  if (options.command !== "sync" && options.command !== "post") {
    throw new Error(`Unknown command: ${options.command}\n\nRun --help for usage.`);
  }
  options.groupId =
    options.groupId || process.env.AGENT_COMMS_GROUP || process.env.WORKFLOW_GROUP_ID;
  if (!options.groupId) {
    throw new Error("--group is required, or set AGENT_COMMS_GROUP/WORKFLOW_GROUP_ID");
  }
  options.instance = resolveInstance(
    options.instance || process.env.AGENT_COMMS_INSTANCE,
    process.env.WORKFLOW_JOB_ID
  );
  if (!options.afterProvided && !options.instance) {
    throw new Error(
      "--after is required unless --name, AGENT_COMMS_INSTANCE, or WORKFLOW_JOB_ID is set"
    );
  }
  if (
    options.afterProvided &&
    (!Number.isFinite(options.after) || options.after < 0)
  ) {
    throw new Error("--after must be a non-negative number");
  }
  if (options.command === "sync" && options.syncAfterPost) {
    throw new Error("--sync is only valid with post");
  }
  if (options.command === "post" && options.afterProvided && !options.syncAfterPost) {
    throw new Error("post does not use --after unless --sync is set");
  }
  if (
    options.limit !== undefined &&
    (!Number.isFinite(options.limit) || options.limit < 1)
  ) {
    throw new Error("--limit must be a positive number");
  }
  if (options.command === "post" && options.limit !== undefined && !options.syncAfterPost) {
    throw new Error("post does not use --limit unless --sync is set");
  }
  if (options.command === "post" && options.messageParts.length === 0) {
    throw new Error("post requires a message");
  }
  if (options.command === "sync" && options.messageParts.length > 0) {
    throw new Error("sync does not accept a message; use post");
  }
  return options;
}

function readOptionValue(argv, index, option) {
  const value = argv[index];
  if (!value || value.startsWith("-")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function resolveInstance(name, workflowJobId) {
  if (!name) return workflowJobId;
  if (!workflowJobId) return name;
  const prefix = `${workflowJobId}:`;
  return name.startsWith(prefix) ? name : `${prefix}${name}`;
}

function sanitizeKey(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getCursorPath(groupId, instance) {
  if (!instance) return undefined;
  const dir = resolve(
    process.env.AGENT_COMMS_CURSOR_DIR || resolve(tmpdir(), "agent-comms-cursors")
  );
  mkdirSync(dir, { recursive: true });
  return resolve(dir, `${sanitizeKey(groupId)}--${sanitizeKey(instance)}.json`);
}

function readCursor(groupId, instance) {
  const path = getCursorPath(groupId, instance);
  if (!path) return 0;
  const state = readJsonFile(path);
  if (!state || typeof state.position !== "number" || state.position < 0) {
    return 0;
  }
  return Math.floor(state.position);
}

function writeCursorState(groupId, instance, patch) {
  const path = getCursorPath(groupId, instance);
  if (!path) return;
  const current = readJsonFile(path) || {};
  writeFileSync(
    path,
    JSON.stringify(
      {
        groupId,
        instance,
        position: 0,
        selfPositions: [],
        ...current,
        ...patch,
        updatedAt: Date.now(),
      },
      null,
      2
    )
  );
}

function writeCursor(groupId, instance, position) {
  writeCursorState(groupId, instance, { position });
}

function rememberSelfPosition(groupId, instance, position) {
  const path = getCursorPath(groupId, instance);
  const current = path ? readJsonFile(path) || {} : {};
  const existing = Array.isArray(current.selfPositions)
    ? current.selfPositions.filter((value) => typeof value === "number")
    : [];
  const selfPositions = Array.from(new Set([...existing, position]))
    .sort((a, b) => a - b)
    .slice(-200);
  writeCursorState(groupId, instance, { selfPositions });
}

function displayInstance(instance) {
  if (!instance) return "unknown";
  const parts = instance.split(":");
  return parts[parts.length - 1] || instance;
}

function formatMessages(messages) {
  if (messages.length === 0) {
    return "No unread messages.";
  }
  return messages
    .map(
      (message) =>
        `[${message.position}] from=${displayInstance(message.instance)} ${message.message}`
    )
    .join("\n");
}

function printRead(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Unread messages (${result.messages.length}):`);
  console.log(formatMessages(result.messages));
  console.log(`cursor_saved=${result.position}`);
}

function printPost(result, json, cursor) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log("Post result (publish only; unread not returned):");
  console.log(`sent_position=${result.sent.position}`);
  console.log(`cursor_unchanged=${cursor}`);
}

function printPostSync(result, readResult, json) {
  if (json) {
    console.log(JSON.stringify({ post: result, sync: readResult }, null, 2));
    return;
  }
  console.log("Post result:");
  console.log(`sent_position=${result.sent.position}`);
  console.log("Sync after post:");
  console.log(`Unread messages (${readResult.messages.length}):`);
  console.log(formatMessages(readResult.messages));
  console.log(`cursor_saved=${readResult.position}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const workflowConfig = readJsonFile(resolve(__dirname, "config.json"));
  const convexUrl =
    options.url ||
    process.env.AGENT_COMMS_CONVEX_URL ||
    workflowConfig?.convexUrl ||
    process.env.CONVEX_URL ||
    process.env.VITE_CONVEX_URL;
  if (!convexUrl) {
    throw new Error(
      "Convex URL is required. Pass --url or set AGENT_COMMS_CONVEX_URL/CONVEX_URL."
    );
  }

  const client = new ConvexHttpClient(convexUrl);
  const after = options.afterProvided
    ? Math.floor(options.after)
    : readCursor(options.groupId, options.instance);
  const args = {
    groupId: options.groupId,
    ...(options.instance ? { instance: options.instance } : {}),
    after,
    ...(options.limit !== undefined ? { limit: Math.floor(options.limit) } : {}),
  };

  if (options.command === "sync") {
    const result = await client.query("agentComms:read", args);
    writeCursor(options.groupId, options.instance, result.position);
    printRead(result, options.json);
  } else {
    const message = options.messageParts.join(" ").trim();
    const result = await client.mutation("agentComms:send", {
      groupId: options.groupId,
      ...(options.instance ? { instance: options.instance } : {}),
      message,
    });
    rememberSelfPosition(options.groupId, options.instance, result.sent.position);
    if (options.syncAfterPost) {
      const readResult = await client.query("agentComms:read", args);
      writeCursor(options.groupId, options.instance, readResult.position);
      printPostSync(result, readResult, options.json);
    } else {
      printPost(result, options.json, after);
    }
  }
}

main().catch((error) => {
  console.error(`agent-comms: ${error.message}`);
  process.exit(1);
});
