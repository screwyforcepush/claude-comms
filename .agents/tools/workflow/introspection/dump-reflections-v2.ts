#!/usr/bin/env npx tsx
import { writeFileSync, readFileSync } from "fs";
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

interface Args {
  output: string;
  last: number;
}

function parseArgs(): Args {
  const args: Args = { output: "/tmp/reflections-v2-dump.json", last: 1000 };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--output") args.output = argv[++i];
    else if (a === "--last") args.last = Number(argv[++i]);
    else if (a === "--help" || a === "-h") {
      console.log(`dump-reflections-v2 — write all V2 reflection rows from all namespaces to a JSON file

V2 capture shape: narrative + items[] (pain points with keywords and suggestions),
as opposed to V1's description/critique/alternativeApproach/improvements buckets.

Usage: dump-reflections-v2.ts [options]

Options:
  --output <path>   Output JSON file (default: /tmp/reflections-v2-dump.json)
  --last <N>        Window per namespace (default 1000, page cap)
  --help, -h        Show this help

Each row in the output array is the raw V2 reflection record from Convex,
augmented with a top-level "namespaceName" field for convenience.
`);
      process.exit(0);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();

  const namespaces: Array<{ _id: string; name: string }> = await client.query(
    api.namespaces.list,
    { password: config.password }
  );

  const all: any[] = [];
  for (const ns of namespaces) {
    const recent = await client.query(api.reflectionsV2.recent, {
      password: config.password,
      namespaceId: ns._id,
      last: args.last,
    });
    const rows = (recent.page ?? []) as any[];
    for (const r of rows) {
      all.push({ ...r, namespaceName: ns.name });
    }
  }

  writeFileSync(args.output, JSON.stringify(all, null, 2));
  console.log(`Wrote ${all.length} V2 reflections to ${args.output}`);
  console.log(`Namespaces: ${namespaces.map((n) => n.name).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
