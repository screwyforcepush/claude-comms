#!/usr/bin/env npx tsx
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const api = anyApi;
const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "config.json");

type Harness = "claude" | "codex" | "gemini";

interface Config {
  convexUrl: string;
  namespace: string;
  password: string;
}

const ANCHOR_KEYS = new Set([
  "assignmentMatchedWork",
  "projectStateClean",
  "followedConventions",
  "docsSufficient",
]);

function classifyRubric(key: string): "anchor" | "risk" {
  return ANCHOR_KEYS.has(key) ? "anchor" : "risk";
}

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

const config = JSON.parse(readFileSync(configPath, "utf-8")) as Config;
const client = new ConvexHttpClient(config.convexUrl);

function help(): void {
  console.log(`Reflection Introspection CLI

Usage:
  reflections.ts <command> [options]

Commands:
  coverage             Show reflection coverage for terminal integration-era jobs
  recent               List recent reflection rows
  gaps                 List terminal jobs missing reflections, with likely reason
  summarize            Aggregate keywords and rubric answers from recent reflections
  job <jobId>          Show latest reflection for one job
  dump                 Write reflections + gaps + joined job rows to NDJSON files for offline analysis
  help                 Show this help

Common options:
  --last <N>           Window over last N terminal jobs/reflections (default varies)
  --job-type <type>    Filter by job type, e.g. implement, pm
  --harness <name>     Filter by harness: claude, codex, gemini
  --json               Emit raw JSON

recent options:
  --full               Include critique, alternativeApproach, improvements

dump options:
  --out <dir>          Output directory (default: $TMPDIR/reflections-<iso-stamp>/)

Recommended analysis workflow:
  Dump the reflections then inline python (or jq) to munge as needed.
  Each NDJSON file is one row per line, so streaming-grep + python is fast and avoids
  re-querying. summarize / coverage / gaps print readouts; dump is for ad-hoc analysis.

  Files written by dump:
    reflections.ndjson  full reflection rows (rubric, keywords, critique, etc.)
    gaps.ndjson         terminal jobs missing reflections + skipReason
    jobs.ndjson         joined job rows incl. prompt, result, assignment.northStar
    meta.json           window, coverage snapshot, observed anchor/risk rubric keys

Examples:
  npx tsx .agents/tools/workflow/reflections.ts coverage --last 50
  npx tsx .agents/tools/workflow/reflections.ts gaps --last 25
  npx tsx .agents/tools/workflow/reflections.ts summarize --last 20
  npx tsx .agents/tools/workflow/reflections.ts dump --last 100

  # Ad-hoc: per-jobtype risk rubric breakdown
  cat \$DUMP/reflections.ndjson | python3 -c "
  import json, sys
  ANCHOR = {'assignmentMatchedWork','projectStateClean','followedConventions','docsSufficient'}
  buckets = {}
  for line in sys.stdin:
      r = json.loads(line)
      b = buckets.setdefault(r['jobType'], {'n':0,'risk':{}})
      b['n'] += 1
      for k,v in r['rubric'].items():
          if k not in ANCHOR and v:
              b['risk'][k] = b['risk'].get(k,0)+1
  print(buckets)
  "
`);
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "help", ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = rest[i + 1];
      if (!next || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

function asString(flags: Record<string, string | boolean>, key: string): string | undefined {
  const value = flags[key];
  if (typeof value !== "string") return undefined;
  return value;
}

function asLast(flags: Record<string, string | boolean>, fallback: number): number {
  const raw = asString(flags, "last");
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) fail("--last must be a positive integer");
  return value;
}

function asHarness(flags: Record<string, string | boolean>): Harness | undefined {
  const value = asString(flags, "harness");
  if (value === undefined) return undefined;
  if (value !== "claude" && value !== "codex" && value !== "gemini") {
    fail("--harness must be claude, codex, or gemini");
  }
  return value;
}

async function namespaceId(): Promise<string> {
  const namespace = await client.query(api.namespaces.getByName, {
    password: config.password,
    name: config.namespace,
  });
  if (!namespace) fail(`Namespace "${config.namespace}" not found`);
  return namespace._id;
}

function commonQueryArgs(flags: Record<string, string | boolean>, fallbackLast: number) {
  const args: Record<string, unknown> = {
    password: config.password,
    last: asLast(flags, fallbackLast),
  };
  const harness = asHarness(flags);
  const jobType = asString(flags, "job-type");
  if (harness) args.harness = harness;
  if (jobType) args.jobType = jobType;
  return args;
}

function pct(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function date(ms: number | undefined): string {
  return ms ? new Date(ms).toISOString() : "(no completedAt)";
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

async function coverage(flags: Record<string, string | boolean>): Promise<void> {
  const nsId = await namespaceId();
  const result = await client.query(api.reflections.coverageRate, {
    ...commonQueryArgs(flags, 25),
    namespaceId: nsId,
  });

  if (flags.json) {
    printJson(result);
    return;
  }

  console.log(`Coverage: ${result.reflectedJobs}/${result.terminalJobs} (${pct(result.rate)})`);
  console.log(`Eligible Claude coverage: ${pct(result.eligibleCoverage)}`);
  for (const [harness, counts] of Object.entries(result.byHarness as Record<string, { reflected: number; terminal: number }>)) {
    console.log(`${harness}: ${counts.reflected}/${counts.terminal}`);
  }
}

async function recent(flags: Record<string, string | boolean>): Promise<void> {
  const nsId = await namespaceId();
  const result = await client.query(api.reflections.recent, {
    ...commonQueryArgs(flags, 10),
    namespaceId: nsId,
  });

  if (flags.json) {
    printJson(result.page);
    return;
  }

  const full = Boolean(flags.full);
  for (const row of result.page) {
    console.log(`${date(row.createdAt)} ${row.jobType}/${row.harness} ${row.jobId}`);
    console.log(`  ${row.description}`);
    if (row.keywords.length > 0) {
      console.log(`  keywords: ${row.keywords.join(", ")}`);
    }
    if (full) {
      console.log(`  critique: ${row.critique}`);
      console.log(`  alternative: ${row.alternativeApproach}`);
      console.log(`  improvements: ${row.improvements}`);
    }
  }
}

async function gaps(flags: Record<string, string | boolean>): Promise<void> {
  const nsId = await namespaceId();
  const result = await client.query(api.reflections.gaps, {
    ...commonQueryArgs(flags, 25),
    namespaceId: nsId,
  });

  if (flags.json) {
    printJson(result);
    return;
  }

  if (result.length === 0) {
    console.log("No reflection gaps in window.");
    return;
  }
  for (const row of result) {
    console.log(`${date(row.completedAt)} ${row.jobType}/${row.harness} ${row.status} ${row.jobId}`);
    console.log(`  reason: ${row.skipReason}; sessionId: ${row.sessionIdPresent ? "present" : "missing"}`);
    if (row.resultPreview) console.log(`  result: ${row.resultPreview}`);
  }
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sortedCounts(map: Map<string, number>): Array<[string, number]> {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

async function summarize(flags: Record<string, string | boolean>): Promise<void> {
  const nsId = await namespaceId();
  const result = await client.query(api.reflections.recent, {
    ...commonQueryArgs(flags, 25),
    namespaceId: nsId,
  });

  const keywords = new Map<string, number>();
  const anchorYes = new Map<string, number>();
  const anchorNo = new Map<string, number>();
  const riskYes = new Map<string, number>();
  const riskNo = new Map<string, number>();
  const byJobType = new Map<string, number>();

  for (const row of result.page) {
    increment(byJobType, row.jobType);
    for (const keyword of row.keywords) increment(keywords, keyword);
    for (const [key, value] of Object.entries(row.rubric)) {
      const kind = classifyRubric(key);
      if (kind === "anchor") increment(value ? anchorYes : anchorNo, key);
      else increment(value ? riskYes : riskNo, key);
    }
  }

  const summary = {
    rows: result.page.length,
    byJobType: sortedCounts(byJobType),
    keywords: sortedCounts(keywords),
    anchorYes: sortedCounts(anchorYes),
    anchorNo: sortedCounts(anchorNo),
    riskYes: sortedCounts(riskYes),
    riskNo: sortedCounts(riskNo),
  };

  if (flags.json) {
    printJson(summary);
    return;
  }

  console.log(`Rows: ${summary.rows}`);
  console.log("Job types:");
  for (const [key, count] of summary.byJobType) console.log(`  ${key}: ${count}`);
  console.log("Keywords:");
  for (const [key, count] of summary.keywords) console.log(`  ${key}: ${count}`);
  console.log("Anchor TRUE (good signal):");
  for (const [key, count] of summary.anchorYes) console.log(`  ${key}: ${count}`);
  if (summary.anchorNo.length > 0) {
    console.log("Anchor FALSE (anchor failed):");
    for (const [key, count] of summary.anchorNo) console.log(`  ${key}: ${count}`);
  }
  console.log("Risk TRUE (friction signal):");
  for (const [key, count] of summary.riskYes) console.log(`  ${key}: ${count}`);
}

async function dump(flags: Record<string, string | boolean>): Promise<void> {
  const nsId = await namespaceId();
  const baseArgs = { ...commonQueryArgs(flags, 100), namespaceId: nsId };

  const [coverageResult, recentResult, gapsResult] = await Promise.all([
    client.query(api.reflections.coverageRate, baseArgs),
    client.query(api.reflections.recent, baseArgs),
    client.query(api.reflections.gaps, baseArgs),
  ]);

  const reflections = recentResult.page as Array<Record<string, unknown>>;
  const gaps = gapsResult as Array<Record<string, unknown>>;

  const jobIds = new Set<string>();
  for (const r of reflections) {
    const id = r.jobId as string | undefined;
    if (id) jobIds.add(id);
  }
  for (const g of gaps) {
    const id = g.jobId as string | undefined;
    if (id) jobIds.add(id);
  }

  const jobs: Array<Record<string, unknown>> = [];
  const failedJobIds: string[] = [];
  for (const id of jobIds) {
    try {
      const row = await client.query(api.jobs.getWithGroup, {
        password: config.password,
        id,
      });
      if (row) jobs.push(row as Record<string, unknown>);
    } catch (err) {
      failedJobIds.push(id);
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outRaw = asString(flags, "out");
  const outDir = outRaw
    ? resolve(outRaw)
    : join(tmpdir(), `reflections-${stamp}`);
  mkdirSync(outDir, { recursive: true });

  const writeNdjson = (file: string, rows: Array<Record<string, unknown>>) => {
    const body = rows.map((row) => JSON.stringify(row)).join("\n");
    writeFileSync(join(outDir, file), rows.length > 0 ? `${body}\n` : "");
  };

  writeNdjson("reflections.ndjson", reflections);
  writeNdjson("gaps.ndjson", gaps);
  writeNdjson("jobs.ndjson", jobs);

  const observedRubricKeys = new Set<string>();
  for (const r of reflections) {
    for (const key of Object.keys((r.rubric ?? {}) as Record<string, boolean>)) {
      observedRubricKeys.add(key);
    }
  }
  const anchorObserved: string[] = [];
  const riskObserved: string[] = [];
  for (const key of observedRubricKeys) {
    if (classifyRubric(key) === "anchor") anchorObserved.push(key);
    else riskObserved.push(key);
  }

  const meta = {
    generatedAt: new Date().toISOString(),
    namespace: { id: nsId, name: config.namespace },
    convexUrl: config.convexUrl,
    window: {
      last: baseArgs.last,
      harness: (baseArgs as Record<string, unknown>).harness ?? null,
      jobType: (baseArgs as Record<string, unknown>).jobType ?? null,
    },
    counts: {
      reflections: reflections.length,
      gaps: gaps.length,
      jobs: jobs.length,
      failedJobFetches: failedJobIds.length,
    },
    coverage: coverageResult,
    rubricKeys: {
      anchor: anchorObserved.sort(),
      risk: riskObserved.sort(),
      anchorReference: [...ANCHOR_KEYS].sort(),
    },
    failedJobIds,
    files: {
      reflections: "reflections.ndjson",
      gaps: "gaps.ndjson",
      jobs: "jobs.ndjson",
    },
  };
  writeFileSync(join(outDir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);

  if (flags.json) {
    printJson({ outDir, ...meta.counts });
    return;
  }
  console.log(`Dumped to: ${outDir}`);
  console.log(`  reflections.ndjson  ${reflections.length} rows`);
  console.log(`  gaps.ndjson         ${gaps.length} rows`);
  console.log(`  jobs.ndjson         ${jobs.length} rows (${failedJobIds.length} failed)`);
  console.log(`  meta.json`);
}

async function job(flags: Record<string, string | boolean>, positional: string[]): Promise<void> {
  const jobId = positional[0];
  if (!jobId) fail("job command requires <jobId>");
  const result = await client.query(api.reflections.byJob, {
    password: config.password,
    jobId,
  });

  if (flags.json) {
    printJson(result);
    return;
  }
  if (!result) {
    console.log("No reflection found.");
    return;
  }
  console.log(`${date(result.createdAt)} ${result.jobType}/${result.harness} ${result.jobId}`);
  console.log(`description: ${result.description}`);
  console.log(`keywords: ${result.keywords.join(", ")}`);
  console.log(`critique:\n${result.critique}`);
  console.log(`alternative:\n${result.alternativeApproach}`);
  console.log(`improvements:\n${result.improvements}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  switch (args.command) {
    case "help":
    case "--help":
    case "-h":
      help();
      return;
    case "coverage":
      await coverage(args.flags);
      return;
    case "recent":
      await recent(args.flags);
      return;
    case "gaps":
      await gaps(args.flags);
      return;
    case "summarize":
      await summarize(args.flags);
      return;
    case "job":
      await job(args.flags, args.positional);
      return;
    case "dump":
      await dump(args.flags);
      return;
    default:
      fail(`unknown command ${args.command}`);
  }
}

main().catch((err) => {
  fail((err as Error).message);
});
