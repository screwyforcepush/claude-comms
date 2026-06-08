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
// Same Steward post-process flow as V1: write-time keywords stay free-form
// for discovery; canonicalization here is lossy and overwrites in place.
// Re-runs are idempotent — the deployed mutation only patches rows where
// keywords actually change. The V2 mutation rewrites BOTH top-level keywords
// AND items[].keywords server-side, so a single entry fixes both layers.
//
// Discipline: variants of the same complaint fold; complement themes (cause
// and effect, e.g. intent-conflict vs silent-reconciliation) stay distinct;
// specific sub-topics (status-update-policy) stay distinct from general
// themes (intent-conflict); singletons that look like genuine discovery
// (specific tool bugs, specific phase names) stay out of the mapping.
//
// Canonical names: reuse V1 canonicals where the theme is identical to V1
// (cli-shell-escaping, context-bloat, todowrite-noise, etc.). New V2 themes
// (artifact-readback, intent-conflict, mcp-churn, kludged-bash, etc.) get
// V2-specific canonicals.
const MAPPING: Record<string, string> = {
  // artifact-readback — the V2 flagship theme: decisions/artifacts arrive as
  // flat prose blobs that can't be addressed by key. Symptom-side framing.
  "artifact-readback-friction": "artifact-readback",
  "artifact-readback-flat-prose": "artifact-readback",
  "artifact-readback-flat-blob": "artifact-readback",
  "artifact-readback-needed": "artifact-readback",
  "artifact-readback-overhead": "artifact-readback",
  "flat-artifact-readback": "artifact-readback",
  "prose-blob-readback": "artifact-readback",
  "artifact-blob-scanning": "artifact-readback",
  "no-keyed-readback": "artifact-readback",
  "no-key-readback": "artifact-readback",
  "no-key-lookup": "artifact-readback",
  "no-key-addressing": "artifact-readback",
  "no-key-based-lookup": "artifact-readback",
  "decision-lookup-friction": "artifact-readback",
  "decision-readback-friction": "artifact-readback",
  "decision-readback": "artifact-readback",
  "decision-record-readback": "artifact-readback",

  // flat-prose-blob — same theme as artifact-readback but shape-side framing:
  // the data is stored as flat prose. Kept distinct from artifact-readback
  // because the keyword set agents reach for genuinely splits this way.
  "flat-decision-blob": "flat-prose-blob",
  "flat-decision-log": "flat-prose-blob",
  "flat-prose-decision-log": "flat-prose-blob",
  "flat-artifact-blob": "flat-prose-blob",
  "flat-prose-decisions": "flat-prose-blob",

  // intent-conflict — rubricV2 focus area #1. Different steers disagreeing.
  // Sub-topic keywords (status-update-policy) stay distinct so the specific
  // recurring topic remains visible in inventory.
  "intent-conflict-aop-vs-northstar": "intent-conflict",
  "intent-conflict-aop-vs-assignment": "intent-conflict",
  "intent-conflict-aop-vs-role": "intent-conflict",
  "intent-conflict-spec-vs-northstar": "intent-conflict",
  "instruction-conflict": "intent-conflict",
  "communication-policy-conflict": "intent-conflict",

  // silent-reconciliation — the COMPLEMENT to intent-conflict. The agent
  // resolved a conflict without surfacing it. Cause = intent-conflict;
  // behaviour = silent-reconciliation. Kept distinct on purpose.

  // input-shape-mismatch — rubricV2 focus area #3. Tool I/O schema doesn't
  // match the agent's mental model. Folds the CLI-side variants where the
  // complaint is "the contract is wrong"; shell-mechanics-only variants go
  // to cli-shell-escaping.
  "cli-input-shape": "input-shape-mismatch",
  "cli-input-shape-mismatch": "input-shape-mismatch",
  "cli-input-marshaling": "input-shape-mismatch",
  "cli-argv-marshalling": "input-shape-mismatch",
  "agent-tool-schema-mismatch": "input-shape-mismatch",
  "subagent-tool-schema-mismatch": "input-shape-mismatch",
  "tool-schema-mismatch": "input-shape-mismatch",
  "tool-schema-drift": "input-shape-mismatch",
  "subagent-schema-mismatch": "input-shape-mismatch",
  "browsertools-input-shape": "input-shape-mismatch",
  "eval-input-shape": "input-shape-mismatch",

  // cli-shell-escaping — shell-mechanics specific (quoting, argv, json-in-argv).
  // V1 canonical retained.
  "shell-quoting": "cli-shell-escaping",
  "shell-quoting-retry": "cli-shell-escaping",
  "shell-escaping": "cli-shell-escaping",
  "shell-quoting-risk": "cli-shell-escaping",
  "shell-escaping-risk": "cli-shell-escaping",
  "json-in-argv": "cli-shell-escaping",
  "stringified-json-argv": "cli-shell-escaping",
  "cli-argv-json": "cli-shell-escaping",
  "cli-json-in-argv": "cli-shell-escaping",
  "cli-argv-json-marshaling": "cli-shell-escaping",
  "cli-argv-prose": "cli-shell-escaping",
  "cli-json-argv": "cli-shell-escaping",
  "cli-stringified-json-argv": "cli-shell-escaping",
  "stringified-json-in-argv": "cli-shell-escaping",

  // mcp-churn — new V2 theme. MCP servers reconnecting / lifecycle noise.
  "mcp-lifecycle-noise": "mcp-churn",
  "mcp-connection-churn": "mcp-churn",
  "mcp-connect-churn": "mcp-churn",
  "mcp-server-flap": "mcp-churn",
  "irrelevant-mcp-churn": "mcp-churn",

  // system-reminder-noise — V1 canonical retained. Unsolicited harness-side
  // context injection. Subset reminders (TodoWrite, Task tool, skill list)
  // stay distinct as named topical clusters.
  "system-reminder-injection": "system-reminder-noise",
  "system-reminder-bloat": "system-reminder-noise",
  "unsolicited-context": "system-reminder-noise",
  "unsolicited-context-injection": "system-reminder-noise",
  "unsolicited-context-noise": "system-reminder-noise",
  "unsolicited-claudemd-injection": "system-reminder-noise",
  "unsolicited-system-reminders": "system-reminder-noise",
  "irrelevant-system-reminders": "system-reminder-noise",
  "irrelevant-system-reminder": "system-reminder-noise",
  "irrelevant-injection": "system-reminder-noise",

  // todowrite-noise — V1 canonical retained.
  "todowrite-system-reminder-noise": "todowrite-noise",

  // task-tool-reminder-noise — sibling of todowrite-noise for the Task tool
  // unsolicited reminders.
  "task-reminder-noise": "task-tool-reminder-noise",
  "task-tool-nag": "task-tool-reminder-noise",

  // skill-list-noise — V1 canonical retained.
  "skills-list-injection": "skill-list-noise",

  // decision-framework-gap — V1 canonical retained. The PM decision-framework
  // is ambiguous / has gaps.
  "decision-framework-ambiguous": "decision-framework-gap",
  "decision-framework-ambiguity": "decision-framework-gap",

  // kludged-bash — new V2 theme. Hand-rolling bash because no dedicated tool
  // exists. The cause-side (`missing-dedicated-tool`) is kept distinct: it
  // points at the gap; this points at the workaround. Same painPoints, but
  // different remedy framing — items[] surface this honestly.
  "kludged-bash-for-missing-tool": "kludged-bash",
  "kludged-bash-pipeline": "kludged-bash",
  "hand-rolled-checks": "kludged-bash",

  // subagent-verification-overhead — new V2 theme. Time spent verifying what
  // subagents claim they did.
  "subagent-claim-verification": "subagent-verification-overhead",
  "crew-claim-verification": "subagent-verification-overhead",
  "subagent-report-distrust": "subagent-verification-overhead",
  "report-distrust": "subagent-verification-overhead",

  // oversized-docs — new V2 theme. Source-of-truth docs / guides have grown
  // past comfortable read budget.
  "oversized-sot-doc": "oversized-docs",
  "oversized-sot-docs": "oversized-docs",
  "oversized-guide-docs": "oversized-docs",
  "oversized-doc": "oversized-docs",
  "oversized-doc-review": "oversized-docs",
  "oversized-roadmap": "oversized-docs",
  "source-of-truth-overload": "oversized-docs",
  "mental-model-token-limit": "oversized-docs",

  // context-bloat — V1 canonical retained.
  "context-budget": "context-bloat",
  "context-budget-pressure": "context-bloat",
  "context-budget-waste": "context-bloat",
  "context-budget-tax": "context-bloat",
  "context-noise": "context-bloat",
  "context-duplication": "context-bloat",
  "context-scan-cost": "context-bloat",
  "context-reconstruction": "context-bloat",
  "context-loading-volume": "context-bloat",
  "prompt-bloat": "context-bloat",

  // tool-output-noise — V1 canonical retained.
  "process-output-noise": "tool-output-noise",
  "grep-noise": "tool-output-noise",
  "process-list-contamination": "tool-output-noise",
  "ansi-progress-spam": "tool-output-noise",

  // deferred-tool-noise — V1 canonical retained.
  "deferred-tool-list-noise": "deferred-tool-noise",
  "deferred-tool-roundtrip": "deferred-tool-noise",

  // dirty-worktree — V1 canonical retained.
  "dirty-worktree-noise": "dirty-worktree",
  "dirty-worktree-inheritance": "dirty-worktree",
  "dirty-worktree-ambiguity": "dirty-worktree",
  "dirty-worktree-baseline": "dirty-worktree",
  "working-tree-noise": "dirty-worktree",

  // parallel-dispatch — V1 canonical retained.
  "parallel-dispatch-missed": "parallel-dispatch",
  "parallel-batch-missed": "parallel-dispatch",

  // ===========================================================================
  // Pass 2 additions (2026-05-26) — accumulated variants over ~2 weeks.
  // ===========================================================================

  // validation-policy-ambiguity — NEW canonical. "What am I supposed to
  // validate / under whose authority" recurring theme.
  "validation-ambiguity": "validation-policy-ambiguity",
  "validation-scope-ambiguity": "validation-policy-ambiguity",
  "validation-scope": "validation-policy-ambiguity",
  "missing-validation-contract": "validation-policy-ambiguity",
  "no-validate-primitive": "validation-policy-ambiguity",
  "validation-policy-conflict": "validation-policy-ambiguity",
  "validation-ownership": "validation-policy-ambiguity",

  // validation-ergonomics — NEW canonical. Friction of running validation
  // tooling (orchestration, latency, prereqs, command drift).
  "validation-orchestration": "validation-ergonomics",
  "validation-orchestration-kludge": "validation-ergonomics",
  "validation-latency": "validation-ergonomics",
  "validation-prerequisites": "validation-ergonomics",
  "validation-command-drift": "validation-ergonomics",

  // validation-output-noise — NEW canonical. Validation logs/warnings noisy
  // or hard to discover. Kept distinct from tool-output-noise because the
  // validation subsystem has its own dynamics.
  "validation-log-discovery": "validation-output-noise",
  "validation-log-ergonomics": "validation-output-noise",
  "validation-baseline-noise": "validation-output-noise",
  "validation-noise": "validation-output-noise",
  "stale-validation-logs": "validation-output-noise",
  "warning-backlog": "validation-output-noise",

  // validation-trust kept distinct — it's about trusting validation outputs,
  // not about ergonomics of running validation. Different remedy framing.

  // orchestration-friction — NEW canonical. Workflow-engine orchestration
  // contract gaps (protocol drift, ergonomics).
  "orchestration-ergonomics": "orchestration-friction",
  "orchestration-protocol-friction": "orchestration-friction",
  "orchestration-protocol-drift": "orchestration-friction",
  "orchestration-contract-drift": "orchestration-friction",

  // line-reference-friction — NEW canonical. file:line references in
  // handoffs go stale or are awkward to produce.
  "line-reference-ergonomics": "line-reference-friction",
  "manual-line-references": "line-reference-friction",
  "stale-line-refs": "line-reference-friction",

  // shared-worktree-race — NEW canonical. Multiple agents in one worktree
  // racing each other. Distinct from dirty-worktree (which is about
  // inherited uncommitted state).
  "shared-worktree": "shared-worktree-race",
  "shared-worktree-concurrency": "shared-worktree-race",
  "concurrent-worktree-mutation": "shared-worktree-race",
  "concurrent-agent-noise": "shared-worktree-race",

  // artifact-readback — additional variants.
  "artifact-blob-parsing": "artifact-readback",
  "artifact-decision-blob": "artifact-readback",
  "artifact-prose-blob": "artifact-readback",
  "artifact-read-back-needed": "artifact-readback",
  "artifact-readback-missing": "artifact-readback",
  "artifacts-blob-parsing": "artifact-readback",
  "artifacts-decisions-flat-prose": "artifact-readback",
  "decision-lookup": "artifact-readback",
  "no-keyed-lookup": "artifact-readback",
  "no-key-structure": "artifact-readback",
  "no-structured-readback": "artifact-readback",
  "keyed-readback-missing": "artifact-readback",
  "decision-record-ergonomics": "artifact-readback",
  "prose-blob-scroll": "artifact-readback",

  // flat-prose-blob — additional variants.
  "flat-decision-record": "flat-prose-blob",
  "flat-prose-decision-record": "flat-prose-blob",
  "flat-prose-decisions-log": "flat-prose-blob",
  "flat-prose-artifacts": "flat-prose-blob",
  "flat-prose-context": "flat-prose-blob",
  "decision-record-flat": "flat-prose-blob",
  "decision-record-density": "flat-prose-blob",

  // intent-conflict — additional variants. Specific recurring topics
  // (intent-conflict-commit-policy, status-update-policy) intentionally
  // stay distinct as sub-topic markers.
  "intent-conflict-template-vs-assignment": "intent-conflict",
  "intent-conflict-template-vs-brief": "intent-conflict",
  "intent-drift": "intent-conflict",
  "aop-vs-assignment": "intent-conflict",

  // input-shape-mismatch — additional variants.
  "tool-schema-lookup": "input-shape-mismatch",
  "undocumented-tool-contract": "input-shape-mismatch",
  "agent-api-mismatch": "input-shape-mismatch",

  // cli-shell-escaping — additional variants.
  "cli-escaping": "cli-shell-escaping",
  "newline-escaping": "cli-shell-escaping",
  "escaped-newlines": "cli-shell-escaping",
  "manual-escaping": "cli-shell-escaping",
  "brittle-escaping": "cli-shell-escaping",
  "argv-json-marshaling": "cli-shell-escaping",
  "argv-stringified-json": "cli-shell-escaping",
  "delimiter-collision": "cli-shell-escaping",

  // mcp-churn — additional variants.
  "mcp-server-churn": "mcp-churn",
  "mcp-connection-noise": "mcp-churn",
  "mcp-lifecycle-churn": "mcp-churn",
  "mcp-lifecycle-reminders": "mcp-churn",

  // deferred-tool-noise — additional variants.
  "deferred-tool-churn": "deferred-tool-noise",
  "deferred-tools-noise": "deferred-tool-noise",
  "deferred-tool-indirection": "deferred-tool-noise",
  "deferred-tool-reminders": "deferred-tool-noise",
  "deferred-tool-schema": "deferred-tool-noise",

  // system-reminder-noise — additional variants.
  "irrelevant-nudge": "system-reminder-noise",
  "irrelevant-context-injection": "system-reminder-noise",
  "irrelevant-tool-reminders": "system-reminder-noise",
  "claude-md-injection": "system-reminder-noise",
  "claudemd-auto-injection": "system-reminder-noise",
  "nested-claudemd-injection": "system-reminder-noise",
  "unsolicited-system-reminder": "system-reminder-noise",
  "prompt-noise": "system-reminder-noise",

  // task-tool-reminder-noise — additional variants.
  "task-nudge-noise": "task-tool-reminder-noise",
  "task-tool-nudge-noise": "task-tool-reminder-noise",

  // decision-framework-gap — additional variants.
  "framework-gap": "decision-framework-gap",
  "judgment-beyond-rules": "decision-framework-gap",

  // subagent-verification-overhead — additional variants. Generic
  // verification-overhead/verification-tax kept distinct because they often
  // refer to non-subagent verification (validation outputs, baselines).
  "claim-verification-burden": "subagent-verification-overhead",
  "crew-report-trust": "subagent-verification-overhead",

  // oversized-docs — additional variants. All "doc too big to fit" forms.
  "doc-paging": "oversized-docs",
  "oversized-spec-doc": "oversized-docs",
  "oversized-doc-calibration": "oversized-docs",
  "oversized-doc-paging": "oversized-docs",
  "oversized-document-paging": "oversized-docs",
  "large-doc-paging": "oversized-docs",
  "large-file-navigation": "oversized-docs",
  "paging-overhead": "oversized-docs",
  "mental-model-paging": "oversized-docs",
  "mental-model-size": "oversized-docs",
  "read-cap": "oversized-docs",
  "read-cap-paging": "oversized-docs",
  "read-token-limit": "oversized-docs",

  // kludged-bash — additional variants. Cause-side (missing-dedicated-tool)
  // kept distinct.
  "missing-codebase-query-tool": "kludged-bash",
  "better-tool-missed": "kludged-bash",
  "mandated-tool-unavailable": "kludged-bash",

  // tool-output-noise — additional variants. tool-output-truncation kept
  // distinct (different complaint: cut off vs noisy).
  "search-result-noise": "tool-output-noise",
  "search-friction": "tool-output-noise",
  "reviewer-output-redundancy": "tool-output-noise",
  "process-inspection-noise": "tool-output-noise",
  "process-introspection-leak": "tool-output-noise",
  "process-introspection": "tool-output-noise",
  "process-overhead": "tool-output-noise",
  "shared-worktree-process-noise": "tool-output-noise",

  // context-bloat — additional variants.
  "context-redundancy": "context-bloat",
  "prompt-envelope-bloat": "context-bloat",

  // silent-reconciliation — additional variants. silent-empty-output kept
  // distinct (tool returning empty is a different complaint).
  "silent-skip": "silent-reconciliation",
};

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
