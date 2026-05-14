#!/usr/bin/env npx tsx
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "..", "config.json");

interface Config {
  convexUrl: string;
  password: string;
}

const config = JSON.parse(readFileSync(configPath, "utf-8")) as Config;
const api = anyApi;
const client = new ConvexHttpClient(config.convexUrl);

// V2 keyword normalize mapping.
// Starts empty — V2 volume is too thin to seed canonicals yet.
// Add entries as keyword variants accumulate from V2 reflections.
// Re-runs are idempotent — the deployed mutation only patches rows
// where keywords actually change.
// The V2 normalizeKeywords mutation rewrites BOTH top-level keywords
// AND items[].keywords server-side, so a single mapping entry fixes
// both layers.
const MAPPING: Record<string, string> = {};

function help(): void {
  console.log(`keywords-normalize-v2 — overwrite V2 reflection keywords in-place via canonical mapping

Usage: keywords-normalize-v2.ts [options]

Options:
  --dry-run      report mapping size and exit without mutating
  --help, -h     show this help

The mapping lives inline at the top of this script. Edit and re-run as new
keyword variants accumulate from fresh V2 reflections. Re-runs are idempotent —
the deployed mutation only patches rows where keywords actually change.

Two-layer rewrite (top-level + items[].keywords) handled server-side — a single
mapping entry fixes both the derived top-level keywords array and the per-item
keywords inside items[].
`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    help();
    return;
  }
  const dryRun = argv.includes("--dry-run");

  console.log(`Mapping entries: ${Object.keys(MAPPING).length}`);
  console.log(`Canonical targets: ${new Set(Object.values(MAPPING)).size}`);
  console.log(`Dry run: ${dryRun}`);

  if (dryRun) return;

  const result = await client.mutation(api.reflectionsV2.normalizeKeywords, {
    password: config.password,
    mapping: MAPPING,
  });
  console.log("Result:", result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
