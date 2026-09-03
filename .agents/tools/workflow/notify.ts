#!/usr/bin/env npx tsx
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { prepareBody } from "./lib/notify-lib.js";

const api = anyApi;
const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "config.json");

interface Config {
  convexUrl: string;
  password: string;
}

function help(): void {
  console.log(`Submit one listenable notification rendition for a chat thread.

Usage:
  notify.ts --thread-id <threadId> --input <path-to-text>
  notify.ts --help

Required:
  --thread-id <id>  The chat thread that should receive the notification row.
  --input <path>    Plain UTF-8 text file containing the notification body.

Body contract:
  - Full substance of the assistant response, made listenable; not a summary.
  - No code blocks, tables, URLs, or markdown syntax noise.
  - Reference files/artifacts by name; do not quote code.
  - The first sentence should carry the headline for collapsed previews.
  - Bodies over 5000 characters are truncated and still posted.

This command validates the file, posts one notifications:post row, prints ok,
and exits. No retries, no response parsing, no thread message is created.
`);
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { help: boolean; threadId?: string; input?: string } {
  const parsed: { help: boolean; threadId?: string; input?: string } = { help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--thread-id") {
      parsed.threadId = argv[++i];
    } else if (arg === "--input") {
      parsed.input = argv[++i];
    } else {
      fail(`unknown argument ${arg}`);
    }
  }
  return parsed;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    help();
    return;
  }
  if (!args.threadId) fail("--thread-id is required");
  if (!args.input) fail("--input is required");
  if (!existsSync(args.input)) fail(`input file not found: ${args.input}`);

  const prepared = prepareBody(readFileSync(args.input, "utf-8"));
  if (!prepared.ok) fail(prepared.error);
  if (prepared.truncated) {
    console.error("warning: body exceeded 5000 characters and was truncated");
  }

  const config = JSON.parse(readFileSync(configPath, "utf-8")) as Config;
  const client = new ConvexHttpClient(config.convexUrl);
  await client.mutation(api.notifications.post, {
    password: config.password,
    threadId: args.threadId as any,
    body: prepared.body,
  });

  console.log("ok");
}

main().catch((err) => {
  fail((err as Error).message);
});
