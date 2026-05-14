#!/usr/bin/env npx tsx
import { spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const REFLECTION_CLI_VERSION = "0.2.0";

const api = anyApi;
const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "config.json");

type Harness = "claude" | "codex" | "gemini";

interface Config {
  convexUrl: string;
  password: string;
}

interface ReflectionItem {
  keywords: string[];
  painPoint: string;
  suggestion: string;
}

interface ReflectionInput {
  narrative: string;
  items: ReflectionItem[];
  rubric: Record<string, boolean>;
}

function help(): void {
  console.log(`Submit a structured reflection on a completed workflow job (V2 capture).

Usage:
  reflect.ts --job-id <jobId> --input <path-to-json>
  reflect.ts --help

Required:
  --job-id <id>    The job you are reflecting on.
  --input  <path>  Path to a JSON file containing the V2 reflection.

Input file shape (V2):
  {
    "narrative": "string — one prose block, rationale + context",
    "items": [
      {
        "keywords": ["theme-1", "theme-2"],
        "painPoint":  "specific friction observed",
        "suggestion": "concrete remedy"
      }
    ],
    "rubric": {
      "<questionKey>": true | false
    }
  }

Item rules:
  - At least one item required (the prompt asks for friction).
  - Each item: keywords[] with length >= 1, non-empty painPoint, non-empty suggestion.
  - Keywords are friction THEMES (e.g. "tool-output-noise"), not locator
    tags (e.g. "phase-6", "this-task"). The top-level keywords field on
    the stored row is derived automatically from the union of items' keywords.

Rubric question keys (v2-draft.r2, 20 questions):
  Intent / context conflicts:
    assignmentInstructionConflict
      "Did you encounter a direct contradiction between two instruction
       sources you were told to follow (north star vs AOP, prompt template
       vs assignment brief, spec vs decision record, etc.)?"
    silentReconciliationForced
      "Did you have to silently choose between two seemingly-authoritative
       steers because they couldn't both be followed as written (without
       surfacing the conflict to the user)?"
    intentDriftMidJob
      "Did your understanding of the assignment's true intent shift mid-job
       because of context that surfaced later (a doc you read mid-job, a
       tool result, a user message, an artifact from a prior PM round)?"
    trainingDefaultOverriddenByProject
      "Did a project-specific instruction (in CLAUDE.md, AGENTS.md, the
       prompt template, the north star, or the user's direct message)
       require you to override or suppress one of your training defaults?"
    decisionFrameworkAmbiguous
      "Did the PM decision-framework rules give an ambiguous mapping for
       the actual situation in front of you, requiring judgment beyond
       the named rules?"

  Context / docs:
    unsolicitedContextReceived
      "Did you receive context you neither asked for nor used — in any
       form — that ate context budget without changing your next action?"
    externalSoTDocsNeeded
      "To act on this assignment, did you need to read at least one
       Source-of-Truth document (mental-model.md, AGENTS.md, a phase
       spec) that was NOT inlined into the prompt?"
    oversizedSingleDocEncountered
      "Did you encounter a single document that you needed to read in
       full, but which exceeded a comfortable single-Read bite (>5k
       tokens or >300 lines) and forced you to either page or skim?"
    artifactReadBackNeeded
      "Did you have to scroll through a flat artifacts/decisions prose
       blob in the prompt to find a specific prior decision or artifact
       (because there is no key-based readback)?"
    sameFileReadMultipleTimes
      "Did you Read the same file more than once during this job for
       reasons other than intentional offset/limit paging through a
       large file?"

  CLI / best-tool-for-job availability:
    kludgedBashForMissingTool
      "Did you compose a multi-step bash pipeline because no single
       dedicated CLI or registered tool cleanly covered the operation?"
    betterToolMissedAtTime
      "Did you discover during or after the job that a better-fitting
       tool / CLI / built-in existed that you didn't reach for at the
       time?"
    toolSchemaLookupRequired
      "Did you have to fetch a tool's schema or read its --help output
       mid-task because the tool surface available to you did not
       include that information up front?"

  Tool ergonomics:
    inputShapeMismatch
      "Did at least one tool require you to marshal its input into a
       shape that didn't match how you held the data — stringified JSON
       in argv, comma-separated lists, manually escaped newlines/quotes,
       etc.?"
    shellQuotingRetry
      "Did at least one Bash invocation fail or require re-quoting
       because shell consumed backticks, single/double quotes, or
       JSON specials before the binary saw the argument?"
    errorMessageUninformative
      "When a tool call failed, did the error message tell you only
       that the call failed without giving you enough to fix it?"
    toolFailedRecoveredSameTurn
      "Did at least one tool call fail with an error that you
       self-corrected on a retry without abandoning the approach?"

  Workflow hygiene:
    parallelReadsMissed
      "Did you make three or more sequential Read/Grep/Glob calls
       within a single decision point that had no inter-dependency
       and could have been issued as one parallel batch?"
    validationRunBeforeCompletion
      "Before reporting this job complete, did you execute the
       project's validation suite (tests, typecheck, lint, smoke
       check, or the AOP-named validate step) at least once?"
    subagentReportNeededVerification
      "Did you re-read source files or rerun a command to verify
       a claim made by a spawned sub-agent, because the report
       alone was not trustworthy?"

Rubric values must be booleans. Omit any key you have no opinion on;
omission is itself signal. Keys not in the list above are accepted
without warning (the schema is intentionally flexible).

Notes:
  - description (V1) was dropped in V2; the narrative absorbs that
    purpose. Passing description triggers a warning and is ignored.
  - V1 fields critique / alternativeApproach / improvements are
    not accepted; passing them is a hard error.
  - The top-level keywords array is derived server-side from the
    union of items[].keywords; do not include it in the input.

(Themes intentionally not in the rubric — CLI/UX specifics, workflow
patterns — are documented as items-friendly in
docs/project/spec/rubric-v2-draft.json under themesNotCovered.)
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

  // Hard-fail on V1 fields
  const v1Fields = ["critique", "alternativeApproach", "improvements"];
  for (const key of v1Fields) {
    if (key in value) {
      fail("V2 CLI: critique/alternativeApproach/improvements were replaced by narrative + items; see --help");
    }
  }

  // Soft-handle description
  if ("description" in value) {
    console.error("warning: description was dropped in V2; the narrative absorbs that purpose. Ignoring.");
  }

  // Reject top-level keywords
  if ("keywords" in value) {
    fail("V2 CLI: top-level keywords are derived server-side from items[].keywords; do not include keywords in input");
  }

  // Validate narrative
  if (typeof value.narrative !== "string" || value.narrative.trim() === "") {
    fail("input.narrative must be a non-empty string");
  }
  const narrative = value.narrative as string;

  // Validate items
  if (!Array.isArray(value.items)) fail("input.items must be an array");
  if (value.items.length < 1) fail("input.items must have at least 1 entry");
  const items: ReflectionItem[] = value.items.map((item: unknown, i: number) => {
    if (!isObject(item)) fail(`items[${i}] must be an object`);

    // Validate keywords
    if (!Array.isArray(item.keywords)) fail(`items[${i}].keywords must be an array`);
    if (item.keywords.length < 1) fail(`items[${i}].keywords must have at least 1 entry`);
    const keywords = item.keywords.map((kw: unknown, ki: number) => {
      if (typeof kw !== "string" || (kw as string).trim() === "") {
        fail(`items[${i}].keywords[${ki}] must be a non-empty string`);
      }
      return kw as string;
    });

    // Validate painPoint
    if (typeof item.painPoint !== "string" || (item.painPoint as string).trim() === "") {
      fail(`items[${i}].painPoint must be a non-empty string`);
    }

    // Validate suggestion
    if (typeof item.suggestion !== "string" || (item.suggestion as string).trim() === "") {
      fail(`items[${i}].suggestion must be a non-empty string`);
    }

    return {
      keywords,
      painPoint: item.painPoint as string,
      suggestion: item.suggestion as string,
    };
  });

  // Validate rubric
  if (!isObject(value.rubric)) fail("input.rubric must be an object");
  const rubric: Record<string, boolean> = {};
  for (const [key, rubricValue] of Object.entries(value.rubric)) {
    if (typeof rubricValue !== "boolean") {
      fail(`input.rubric.${key} must be a boolean`);
    }
    rubric[key] = rubricValue;
  }

  return { narrative, items, rubric };
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

  await client.mutation(api.reflectionsV2.insert, {
    password: config.password,
    jobId: args.jobId as any,
    sessionId: job.sessionId,
    namespaceId: job.namespaceId,
    harness: job.harness as Harness,
    jobType: job.jobType,
    totalTokens: job.totalTokens,
    toolCallCount: job.toolCallCount,
    durationMs: durationMs(job),
    narrative: input.narrative,
    items: input.items,
    rubric: input.rubric,
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
