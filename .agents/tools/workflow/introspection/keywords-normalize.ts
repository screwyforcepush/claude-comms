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

// Vibes-based canonical mapping. Edit this as new keyword variants accumulate
// from fresh reflections — re-run is idempotent. Singletons that look like
// genuine discovery-loop output (specific bugs, specific patterns) are left
// out; only fold variants that are semantically the same complaint.
const MAPPING: Record<string, string> = {
  // TodoWrite reminder / nag / spam / deferred — same complaint, many spellings
  "todowrite-reminder-noise": "todowrite-noise",
  "todowrite-deferred": "todowrite-noise",
  "todo-reminder-noise": "todowrite-noise",
  "todowrite-spam": "todowrite-noise",
  "todowrite-nag": "todowrite-noise",
  "todowrite-reminder-spam": "todowrite-noise",
  "todowrite-reminder-cadence": "todowrite-noise",
  "todowrite-friction": "todowrite-noise",
  "todowrite-late": "todowrite-noise",
  "todowrite-misfire": "todowrite-noise",
  "todowrite-nag-loop": "todowrite-noise",
  "todoWrite-noise": "todowrite-noise",
  "todowrite-noise-on-pm-turn": "todowrite-noise",
  "todowrite-not-preloaded": "todowrite-noise",
  "todowrite-nudge-overfire": "todowrite-noise",
  "todowrite-overprompting": "todowrite-noise",
  "todowrite-reminder-mistargeted": "todowrite-noise",
  "todoWrite-reminder-noise": "todowrite-noise",
  "todowrite-reminder-noise-on-every-call": "todowrite-noise",
  "todowrite-reminder-noise-on-linear-jobs": "todowrite-noise",
  "todowrite-deferred-load-roundtrip": "todowrite-noise",
  "todowrite-deferred-overhead": "todowrite-noise",
  "todo-deferred": "todowrite-noise",
  "todo-overhead": "todowrite-noise",
  "todo-reminder-spam": "todowrite-noise",
  "tooldeferral-todowrite": "todowrite-noise",

  // System reminder
  "system-reminder-bloat": "system-reminder-noise",
  "system-reminder-cadence": "system-reminder-noise",
  "system-reminder-fatigue": "system-reminder-noise",
  "system-reminder-fused-signals": "system-reminder-noise",
  "system-reminder-injection-noise": "system-reminder-noise",
  "system-reminder-injection-shape": "system-reminder-noise",
  "system-reminder-leak": "system-reminder-noise",
  "system-reminder-mid-tool-output": "system-reminder-noise",
  "system-reminder-nag-loop": "system-reminder-noise",
  "system-reminder-noise-in-stdout": "system-reminder-noise",
  "system-reminder-noise-on-PM-turns": "system-reminder-noise",
  "system-reminder-pollution": "system-reminder-noise",
  "session-start-noise": "system-reminder-noise",
  "mcp-instructions-unsolicited": "system-reminder-noise",

  // Deferred tools
  "deferred-tools-noise": "deferred-tool-noise",
  "deferred-tool-friction": "deferred-tool-noise",
  "deferred-tool-bloat": "deferred-tool-noise",
  "deferred-tool-overhead": "deferred-tool-noise",
  "deferred-tool-tax": "deferred-tool-noise",
  "deferred-tools": "deferred-tool-noise",
  "deferred-tool-dance": "deferred-tool-noise",
  "deferred-tool-list-irrelevance": "deferred-tool-noise",
  "deferred-tool-list-noise": "deferred-tool-noise",
  "deferred-tool-loading": "deferred-tool-noise",
  "deferred-tool-reminder-noise": "deferred-tool-noise",
  "deferred-tool-roundtrip": "deferred-tool-noise",
  "deferred-tool-schema-friction": "deferred-tool-noise",
  "deferred-tool-search-dance": "deferred-tool-noise",
  "deferred-tools-clutter": "deferred-tool-noise",
  "deferred-tools-context-bloat": "deferred-tool-noise",
  "deferred-tools-context-tax": "deferred-tool-noise",
  "deferred-tools-friction": "deferred-tool-noise",
  "deferred-tools-overhead": "deferred-tool-noise",
  "deferred-tools-reminder": "deferred-tool-noise",
  "deferred-tools-roundtrip": "deferred-tool-noise",
  "deferred-tools-unfiltered": "deferred-tool-noise",
  "toolsearch-friction": "deferred-tool-noise",
  "toolsearch-overhead": "deferred-tool-noise",
  "tool-deferral-overhead": "deferred-tool-noise",

  // PM Navigator
  "navigator-pm": "pm-navigator",
  "pm-navigation": "pm-navigator",
  "pm-navigator-aop-overhead": "pm-navigator",
  "navigator-pm-checkpoint": "pm-navigator",
  "navigator-pm-completion": "pm-navigator",
  "navigator-pm-gate-decision": "pm-navigator",

  // Context bloat
  "context-overload": "context-bloat",
  "context-pollution": "context-bloat",
  "context-loading": "context-bloat",
  "context-loading-overhead": "context-bloat",
  "context-loading-excessive": "context-bloat",
  "context-bloat-decision-record": "context-bloat",
  "context-bloat-system-reminders": "context-bloat",
  "context-boilerplate-overhead": "context-bloat",
  "context-budget": "context-bloat",
  "context-compaction": "context-bloat",
  "context-cost": "context-bloat",
  "context-dump-density": "context-bloat",
  "context-duplication": "context-bloat",
  "context-frontmatter-bloat": "context-bloat",
  "context-load-serial": "context-bloat",
  "context-loading-budget": "context-bloat",
  "context-loading-frontheavy": "context-bloat",
  "context-loading-redundant": "context-bloat",
  "context-loading-tax": "context-bloat",
  "context-loading-volume": "context-bloat",
  "context-noise": "context-bloat",
  "context-overhead": "context-bloat",
  "context-overlap": "context-bloat",
  "context-reconstruction": "context-bloat",
  "context-redundancy": "context-bloat",
  "context-tax": "context-bloat",
  "context-volume-completion-review": "context-bloat",

  // Insert-job CLI friction (specific to that command)
  "insert-job-jobs-file": "insert-job-cli-friction",
  "jobs-file-flag-missing": "insert-job-cli-friction",
  "insert-job-ergonomics": "insert-job-cli-friction",
  "insert-job-escaping": "insert-job-cli-friction",
  "insert-job-input-flag": "insert-job-cli-friction",
  "insert-job-quoting": "insert-job-cli-friction",
  "insert-job-shell-quoting": "insert-job-cli-friction",
  "insert-job-cli": "insert-job-cli-friction",
  "insert-job-cli-bash-quoting": "insert-job-cli-friction",
  "insert-job-cli-fragility": "insert-job-cli-friction",
  "insert-job-context-brittle": "insert-job-cli-friction",
  "insert-job-dryrun": "insert-job-cli-friction",
  "insert-job-fanout-undocumented": "insert-job-cli-friction",
  "insert-job-file-input": "insert-job-cli-friction",
  "insert-job-inline-json": "insert-job-cli-friction",
  "insert-job-json-brittle": "insert-job-cli-friction",
  "insert-job-json-escaping": "insert-job-cli-friction",
  "insert-job-json-string-brittleness": "insert-job-cli-friction",
  "insert-job-jsonfile": "insert-job-cli-friction",
  "insert-job-needs-file-input": "insert-job-cli-friction",
  "insert-job-payload-shape": "insert-job-cli-friction",
  "insert-job-quoting-friction": "insert-job-cli-friction",
  "insert-job-shell-escape": "insert-job-cli-friction",
  "insert-job-shell-escaping": "insert-job-cli-friction",
  "insert-job-shell-payload-size": "insert-job-cli-friction",
  "jobs-file": "insert-job-cli-friction",

  // Generic shell escaping (not insert-job specific)
  "shell-escaping": "cli-shell-escaping",
  "shell-escaping-cli-args": "cli-shell-escaping",
  "shell-escaping-friction": "cli-shell-escaping",
  "shell-arg-friction": "cli-shell-escaping",
  "shell-escape-footgun": "cli-shell-escaping",
  "shell-escape-friction": "cli-shell-escaping",
  "shell-quoting": "cli-shell-escaping",
  "shell-quoting-footgun": "cli-shell-escaping",
  "json-in-bash": "cli-shell-escaping",
  "json-in-shell-brittle": "cli-shell-escaping",
  "json-in-shell-brittleness": "cli-shell-escaping",
  "json-in-shell-escaping": "cli-shell-escaping",
  "shell-json-brittleness": "cli-shell-escaping",
  "shell-json-friction": "cli-shell-escaping",
  "backtick-shell-substitution": "cli-shell-escaping",
  "bash-quoting": "cli-shell-escaping",
  "inline-json-shell-quoting": "cli-shell-escaping",
  "json-array-cli-quoting": "cli-shell-escaping",
  "json-argv-escaping-fragile": "cli-shell-escaping",
  "json-escaped-job-context": "cli-shell-escaping",
  "json-stringified-cli-flag-fragility": "cli-shell-escaping",
  "stringified-json-cli-args": "cli-shell-escaping",
  "tempfile-for-json-args": "cli-shell-escaping",
  "tempfile-fallback": "cli-shell-escaping",
  "tempfile-workaround": "cli-shell-escaping",
  "shell-parse-error": "cli-shell-escaping",

  // Update-assignment friction
  "update-assignment-no-readback": "update-assignment-friction",
  "two-call-update-assignment": "update-assignment-friction",
  "update-assignment-cli-bash-quoting": "update-assignment-friction",
  "update-assignment-echo": "update-assignment-friction",
  "update-assignment-echo-missing": "update-assignment-friction",
  "update-assignment-needs-file-input": "update-assignment-friction",
  "update-assignment-no-echo": "update-assignment-friction",
  "update-assignment-opacity": "update-assignment-friction",

  // Read tool cap
  "read-cap-too-low": "read-token-cap",
  "read-token-cap-mental-model": "read-token-cap",
  "read-token-limit": "read-token-cap",
  "read-tool-line-truncation": "read-token-cap",
  "read-tool-token-cap": "read-token-cap",
  "long-doc-read-cap": "read-token-cap",
  "large-file-read-budget": "read-token-cap",

  // Completion review (the workflow pattern)
  "completion-review-dispatch": "completion-review",
  "completion-review-3": "completion-review",
  "completion-review-4": "completion-review",
  "completion-review-blocked": "completion-review",
  "completion-review-closure": "completion-review",
  "completion-review-cycle": "completion-review",
  "completion-review-fail": "completion-review",
  "completion-review-iteration": "completion-review",
  "completion-review-pattern": "completion-review",
  "completion-review-triage": "completion-review",
  "completion-review-trio-dispatch": "completion-review",
  "phase3-completion-review": "completion-review",
  "phase-3-completion-review-4": "completion-review",
  "phase-1-completion-review": "completion-review",

  // Plan review
  "plan-review-triage": "plan-review",
  "plan-review-gate": "plan-review",
  "plan-review-handoff": "plan-review",
  "plan-review-landings-verification": "plan-review",
  "plan-review-only-ambiguity": "plan-review",

  // Decision framework gap
  "decision-framework-ambiguity": "decision-framework-gap",
  "decision-framework-binary": "decision-framework-gap",
  "decision-framework-blind-spot": "decision-framework-gap",
  "decision-framework-clear": "decision-framework-gap",
  "decision-framework-fuzzy": "decision-framework-gap",
  "decision-framework-no-escape-hatch": "decision-framework-gap",
  "decision-framework-override": "decision-framework-gap",
  "decision-framework-partial-completion": "decision-framework-gap",
  "decision-framework-rigidity": "decision-framework-gap",
  "decision-framework-rule-1": "decision-framework-gap",
  "decision-framework-rule-4": "decision-framework-gap",
  "decision-framework-skip-review-branch": "decision-framework-gap",
  "decision-framework-step-3": "decision-framework-gap",
  "decision-framework-step3-vs-step4": "decision-framework-gap",
  "decision-framework-tiebreaker": "decision-framework-gap",
  "decision-framework-user-gated-completion": "decision-framework-gap",
  "pm-decision-framework-clear": "decision-framework-gap",
  "rule1-vs-rule4-tiebreaker": "decision-framework-gap",

  // Browsertools
  "browsertools": "browsertools-friction",
  "browsertools-eval-syntax": "browsertools-friction",
  "browsertools-cli-friction": "browsertools-friction",
  "browsertools-conslist-enum-no-comma": "browsertools-friction",
  "browsertools-conslist-types-enum": "browsertools-friction",
  "browsertools-eval-arrow-function-undocumented": "browsertools-friction",
  "browsertools-eval-function-form": "browsertools-friction",
  "browsertools-fill-react-controlled-input": "browsertools-friction",
  "browsertools-fill-slider-noop": "browsertools-friction",
  "browsertools-wait-schema-mismatch": "browsertools-friction",
  "browser-toolkit-setup": "browsertools-friction",
  "browser-daemon-leak-on-agent-exit": "browsertools-friction",
  "eval-arrow-function": "browsertools-friction",
  "eval-arrow-wrapper": "browsertools-friction",
  "eval-requires-function-expression": "browsertools-friction",
  "eval-syntax": "browsertools-friction",
  "eval-syntax-unclear": "browsertools-friction",

  // Doc steward
  "documentation-steward": "doc-steward",

  // Convex CLI
  "convex-cli": "convex-cli-friction",
  "convex-cli-json-noise": "convex-cli-friction",
  "convex-cli-json-output-quirk": "convex-cli-friction",
  "convex-cli-json-wrapping": "convex-cli-friction",
  "convex-cli-trace-audit-pattern": "convex-cli-friction",

  // Mental model size
  "mental-model-too-large-to-read": "mental-model-too-large",
  "mental-model-untruncated-fail": "mental-model-too-large",
  "oversized-mental-model": "mental-model-too-large",

  // Worktree friction
  "worktree-isolation": "worktree-friction",
  "worktree-isolation-missing": "worktree-friction",
  "worktree-gitignore-trap": "worktree-friction",
  "shared-working-tree": "worktree-friction",

  // CLI ergonomics generic
  "cli-arg-brittleness": "cli-ergonomics",
  "cli-context-file-missing": "cli-ergonomics",
  "cli-escape-friction": "cli-ergonomics",
  "cli-escaping-friction": "cli-ergonomics",
  "cli-help-missing": "cli-ergonomics",
  "cli-input-file": "cli-ergonomics",
  "cli-jsonfile-input": "cli-ergonomics",
  "cli-quoting-brittle": "cli-ergonomics",
  "cli-quoting-footgun": "cli-ergonomics",
  "cli-quoting-fragility": "cli-ergonomics",
  "cli-quoting-friction": "cli-ergonomics",
  "cli-string-brittleness": "cli-ergonomics",
  "cli-update-assignment-csv": "cli-ergonomics",
  "missing-input-file-flag": "cli-ergonomics",
  "no-file-input-flag": "cli-ergonomics",
  "workflow-cli-input-flag-missing": "cli-ergonomics",
  "workflow-cli": "cli-ergonomics",
  "no-state-echo": "cli-ergonomics",
  "no-dry-run-no-echo": "cli-ergonomics",
  "no-context-preview": "cli-ergonomics",
  "missing-preview-before-submit": "cli-ergonomics",
  "no-roundtrip-verification": "cli-ergonomics",
  "instance-flag-tax": "cli-ergonomics",
  "no-assignment-show": "cli-ergonomics",
  "no-read-side-cli": "cli-ergonomics",
  "no-verify-report-cli": "cli-ergonomics",
  "no-prior-job-readback": "cli-ergonomics",

  // Closure record (artifact)
  "closure-record-first": "closure-record",
  "closure-record-paperwork": "closure-record",
  "closure-record-review": "closure-record",
  "closure-record-skim-anchors": "closure-record",
  "closing-10-rerun": "closure-record",

  // Closure readiness (state) — distinct from record
  "closure-readiness-round-N-fatigue": "closure-readiness",
  "closure-readiness-slice-pattern": "closure-readiness",
  "closure-readiness-spiral": "closure-readiness",
  "closure-not-first-class-verb": "closure-readiness",
  "closure-completion-path": "closure-readiness",

  // CWD persistence
  "cwd-drift-across-agents": "cwd-persistence",
  "cwd-persistence-trap": "cwd-persistence",
  "cwd-pollution": "cwd-persistence",
  "cd-persistence": "cwd-persistence",
  "absolute-paths-not-cd": "cwd-persistence",

  // Engineer handoff
  "engineer-edit-persistence": "engineer-handoff",
  "engineer-fluff-tdd-claim": "engineer-handoff",
  "engineer-handoff-prose-vs-structured": "engineer-handoff",
  "engineer-persistence-warning": "engineer-handoff",
  "engineer-report-falsifiability": "engineer-handoff",
  "engineer-summary-not-trustworthy": "engineer-handoff",
  "agent-write-not-persisting": "engineer-handoff",

  // Skill list
  "skill-list-pollution": "skill-list-noise",
  "skill-list-unfiltered": "skill-list-noise",
  "irrelevant-skills-noise": "skill-list-noise",

  // Decision record bloat
  "decision-log-bloat": "decision-record-bloat",
  "decision-record-drift": "decision-record-bloat",
  "decision-record-duplication": "decision-record-bloat",
  "decision-record-flat-text": "decision-record-bloat",
  "decision-record-handoff": "decision-record-bloat",
  "decision-record-length": "decision-record-bloat",
  "decision-record-sprawl": "decision-record-bloat",
  "decision-record-as-anchor": "decision-record-bloat",
  "decisions-blob-flat-string": "decision-record-bloat",
  "decisions-log-bloat": "decision-record-bloat",
  "decisions-log-density": "decision-record-bloat",
  "decisions-log-flat-no-filter": "decision-record-bloat",
  "decisions-log-no-rotation": "decision-record-bloat",
  "decisions-log-scaling": "decision-record-bloat",
  "decision-ledger-append-only": "decision-record-bloat",
  "decision-log-accretion": "decision-record-bloat",
  "decision-granularity-drift": "decision-record-bloat",
  "freeform-decisions-ledger": "decision-record-bloat",
  "adr-narrative-heavy": "decision-record-bloat",

  // Artifact bloat (assignment artifacts/decisions stored as flat strings)
  "artifact-blob-bloat": "artifact-bloat",
  "artifact-block-prose-not-structured": "artifact-bloat",
  "artifact-format-mismatch": "artifact-bloat",
  "artifact-handoff": "artifact-bloat",
  "artifact-log-bloat": "artifact-bloat",
  "artifact-log-unstructured": "artifact-bloat",
  "artifact-string-format-unwieldy": "artifact-bloat",
  "artifacts-bloat": "artifact-bloat",
  "artifacts-blob-bloat": "artifact-bloat",
  "artifacts-blob-prose-density": "artifact-bloat",
  "artifacts-cli-string-fragility": "artifact-bloat",
  "artifacts-decisions-append-only-bloat": "artifact-bloat",
  "artifacts-decisions-format-implicit": "artifact-bloat",
  "artifacts-decisions-string-bloat": "artifact-bloat",
  "artifacts-decisions-string-format": "artifact-bloat",
  "artifacts-decisions-unstructured": "artifact-bloat",
  "artifacts-flat-string-footgun": "artifact-bloat",
  "artifacts-monotonic-prose": "artifact-bloat",
  "artifacts-no-readback": "artifact-bloat",
  "artifacts-string-soup": "artifact-bloat",
  "artifact-log-as-fact-without-verification": "artifact-bloat",
  "artifacts-append-only": "artifact-bloat",
  "artifacts-append-structured": "artifact-bloat",
  "append-only-prose-blob": "artifact-bloat",
  "assignment-artifacts-append-only": "artifact-bloat",
  "unstructured-artifacts": "artifact-bloat",

  // Parallel dispatch
  "parallel-agents": "parallel-dispatch",
  "parallel-batch-coordination": "parallel-dispatch",
  "parallel-batch-disjoint-writesets": "parallel-dispatch",
  "parallel-batches": "parallel-dispatch",
  "parallel-batching": "parallel-dispatch",
  "parallel-batching-underused": "parallel-dispatch",
  "parallel-discovery-batching": "parallel-dispatch",
  "parallel-engineers": "parallel-dispatch",
  "parallel-explore-fanout": "parallel-dispatch",
  "parallel-fan-out-boilerplate": "parallel-dispatch",
  "parallel-fan-out-overhead": "parallel-dispatch",
  "parallel-gates": "parallel-dispatch",
  "parallel-job-coordination": "parallel-dispatch",
  "parallel-orchestration-theater": "parallel-dispatch",
  "parallel-reads": "parallel-dispatch",
  "parallel-reads-missed": "parallel-dispatch",
  "parallel-strand-coordination": "parallel-dispatch",
  "parallel-tooling": "parallel-dispatch",
  "parallel-write-collision": "parallel-dispatch",
  "parallel-agent-coordination": "parallel-dispatch",
  "missed-parallel-reads": "parallel-dispatch",
  "serial-reads-avoidable": "parallel-dispatch",
  "serial-reads-could-parallelise": "parallel-dispatch",
  "sequential-when-parallel-possible": "parallel-dispatch",
};

function help(): void {
  console.log(`keywords-normalize — overwrite reflection keywords in-place via canonical mapping

Usage: keywords-normalize.ts [options]

Options:
  --dry-run      report mapping size and exit without mutating
  --help, -h     show this help

The mapping lives inline at the top of this script. Edit and re-run as new
keyword variants accumulate from fresh reflections. Re-runs are idempotent —
the deployed mutation only patches rows where keywords actually change.

Aligns with the Steward post-process flow described in mental-model.md:
write-time keywords stay free-form for discovery; canonicalization here is
lossy and overwrites in place.
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

  const result = await client.mutation(api.reflections.normalizeKeywords, {
    password: config.password,
    mapping: MAPPING,
  });
  console.log("Result:", result);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
