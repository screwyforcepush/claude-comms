#!/usr/bin/env npx tsx
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { fetchAllReflectionsV2, fetchRecentReflectionsV2 } from "../lib/reflections-fetch.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "..", "config.json");

interface Config {
  convexUrl: string;
  password: string;
  namespace: string;
}

const config = JSON.parse(readFileSync(configPath, "utf-8")) as Config;
const api = anyApi;
const client = new ConvexHttpClient(config.convexUrl);

interface Args {
  last?: number;
  since?: number;
  scope: "all" | "current";
  json: boolean;
}

function parseArgs(): Args {
  const args: Args = { scope: "all", json: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--last") args.last = Number(argv[++i]);
    else if (a === "--since") args.since = Number(argv[++i]);
    else if (a === "--current") args.scope = "current";
    else if (a === "--all") args.scope = "all";
    else if (a === "--json") args.json = true;
    else if (a === "--help" || a === "-h") {
      console.log(`keywords-inventory-v2 — keyword counts across V2 reflections

Counts top-level (entry-level) keywords on V2 rows; items[]-level counting
deliberately omitted (per mental-model.md §Structural Direction — aggregate
volume at the entry level is the honest severity signal).

By default every row is fetched by paging the table per namespace.

Usage: keywords-inventory-v2.ts [options]

Options:
  --all          (default) count across all namespaces
  --current      only the namespace named in config.json
  --since <ms>   only rows created at or after this epoch-ms timestamp
  --last <N>     instead of paging everything, take only the most recent N
                 rows per namespace (server cap 1000)
  --json         emit JSON instead of a sorted text table
`);
      process.exit(0);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();

  const namespaces: Array<{ _id: string; name: string }> =
    args.scope === "all"
      ? await client.query(api.namespaces.list, { password: config.password })
      : [
          await client.query(api.namespaces.getByName, {
            password: config.password,
            name: config.namespace,
          }),
        ].filter(Boolean);

  const counts = new Map<string, number>();
  let scanned = 0;

  for (const ns of namespaces) {
    const rows: Array<{ keywords?: string[] }> = args.last !== undefined
      ? await fetchRecentReflectionsV2(client, config.password, ns._id, args.last)
      : await fetchAllReflectionsV2(client, config.password, ns._id, { since: args.since });
    scanned += rows.length;
    for (const r of rows) {
      for (const kw of r.keywords ?? []) {
        counts.set(kw, (counts.get(kw) ?? 0) + 1);
      }
    }
  }

  const sorted = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          namespaces: namespaces.map((n) => n.name),
          rowsScanned: scanned,
          distinctKeywords: sorted.length,
          counts: Object.fromEntries(sorted),
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`Namespaces: ${namespaces.map((n) => n.name).join(", ")}`);
  console.log(`Rows scanned: ${scanned}`);
  console.log(`Distinct keywords: ${sorted.length}`);
  console.log("");
  for (const [kw, n] of sorted) {
    console.log(`${String(n).padStart(4)}  ${kw}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
