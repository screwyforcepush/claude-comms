#!/usr/bin/env npx tsx
import { spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const REFLECTION_CLI_VERSION = "0.1.0";

const api = anyApi;
const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "config.json");

type Harness = "claude" | "codex" | "gemini";

interface Config {
  convexUrl: string;
  password: string;
}

interface ReflectionInput {
  description: string;
  critique: string;
  alternativeApproach: string;
  improvements: string;
  rubric: Record<string, boolean>;
  keywords: string[];
}

function help(): void {
  console.log(`Submit a structured reflection on a completed workflow job.

Usage:
  reflect.ts --job-id <jobId> --input <path-to-json>
  reflect.ts --help

Required:
  --job-id <id>       The job you are reflecting on.
  --input  <path>     Path to a JSON file containing the structured reflection.

Input file shape:
  {
    "description": "string",
    "critique": "string",
    "alternativeApproach": "string",
    "improvements": "string",
    "rubric": {
      "<questionKey>": true
    },
    "keywords": ["string"]
  }

Current draft rubric question keys (v1):
  Clarity:     intentInferred, assignmentMatchedWork
  Tooling:     toolErrorsBlocked, toolRepetitionRequired, neededToolMissing,
               toolOutputNoise, toolOutputInsufficient
  Environment: projectStateClean, undocumentedSetup, hiddenContextDiscovered,
               priorStateInterfered
  Efficiency:  repeatedWork, wrongPathFirst, contextLoadingExcessive
  Approach:    sameApproachAgain, overengineeredPart, underdeliveredPart,
               followedConventions
  Knowledge:   docsSufficient, assumedUnverified

Rubric keys are flexible. Omit any key if you have no opinion. Values must be booleans.
`);
}

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { help: boolean; jobId?: string; input?: string } {
  const parsed: { help: boolean; jobId?: string; input?: string } = { help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--job-id") {
      parsed.jobId = argv[++i];
    } else if (arg === "--input") {
      parsed.input = argv[++i];
    } else {
      fail(`unknown argument ${arg}`);
    }
  }
  return parsed;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateInput(value: unknown): ReflectionInput {
  if (!isObject(value)) fail("input JSON must be an object");

  const requiredStrings = [
    "description",
    "critique",
    "alternativeApproach",
    "improvements",
  ];
  for (const key of requiredStrings) {
    if (typeof value[key] !== "string") {
      fail(`input.${key} must be a string`);
    }
  }

  if (!isObject(value.rubric)) fail("input.rubric must be an object");
  const rubric: Record<string, boolean> = {};
  for (const [key, rubricValue] of Object.entries(value.rubric)) {
    if (typeof rubricValue !== "boolean") {
      fail(`input.rubric.${key} must be a boolean`);
    }
    rubric[key] = rubricValue;
  }

  if (!Array.isArray(value.keywords)) fail("input.keywords must be an array");
  const keywords = value.keywords.map((keyword, index) => {
    if (typeof keyword !== "string") {
      fail(`input.keywords[${index}] must be a string`);
    }
    return keyword;
  });

  return {
    description: value.description as string,
    critique: value.critique as string,
    alternativeApproach: value.alternativeApproach as string,
    improvements: value.improvements as string,
    rubric,
    keywords,
  };
}

function gitSha(cwd: string): string | undefined {
  const result = spawnSync("git", ["-C", cwd, "rev-parse", "HEAD"], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) return undefined;
  const sha = result.stdout.trim();
  return sha || undefined;
}

function durationMs(job: { startedAt?: number; completedAt?: number }): number | undefined {
  if (job.startedAt === undefined || job.completedAt === undefined) return undefined;
  return Math.max(0, job.completedAt - job.startedAt);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    help();
    return;
  }
  if (!args.jobId) fail("--job-id is required");
  if (!args.input) fail("--input is required");
  if (!existsSync(args.input)) fail(`input file not found: ${args.input}`);

  const raw = readFileSync(args.input, "utf-8");
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err) {
    fail(`input file is not valid JSON: ${(err as Error).message}`);
  }
  const input = validateInput(parsedJson);

  const config = JSON.parse(readFileSync(configPath, "utf-8")) as Config;
  const client = new ConvexHttpClient(config.convexUrl);
  const job = await client.query(api.jobs.get, {
    password: config.password,
    id: args.jobId as any,
  });

  if (!job) fail("job not found");
  if (job.status !== "complete" && job.status !== "failed") {
    fail(`job must be terminal, got ${job.status}`);
  }
  if (!job.namespaceId) fail("job is missing namespaceId; historical jobs cannot reflect");
  if (!job.sessionId) fail("job is missing sessionId");

  await client.mutation(api.reflections.insert, {
    password: config.password,
    jobId: args.jobId as any,
    sessionId: job.sessionId,
    namespaceId: job.namespaceId,
    harness: job.harness as Harness,
    jobType: job.jobType,
    totalTokens: job.totalTokens,
    toolCallCount: job.toolCallCount,
    durationMs: durationMs(job),
    ...input,
    reflectionCliVersion: REFLECTION_CLI_VERSION,
    clientGitSha: gitSha(process.cwd()),
    engineGitSha: gitSha(__dirname),
    createdAt: Date.now(),
  });

  console.log("ok");
}

main().catch((err) => {
  fail((err as Error).message);
});
