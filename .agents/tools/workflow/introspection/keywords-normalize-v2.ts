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

  // ===========================================================================
  // Pass 3 additions (2026-08-07) — ~10 weeks of accumulation since Pass 2.
  // ===========================================================================

  // memory-injection — NEW canonical, Steward-directed split: memory is
  // something WE manage (index pruning, relevance gating), while
  // system-reminder-noise is harness behaviour we can only compensate for.
  // Injection-flavoured keywords land here even when they mention the index.
  "unsolicited-memory-injection": "memory-injection",
  "irrelevant-memory-injection": "memory-injection",
  "memory-injection-bloat": "memory-injection",
  "memory-injection-noise": "memory-injection",
  "memory-injection-irrelevant": "memory-injection",
  "memory-injection-scope": "memory-injection",
  "memory-reinjection": "memory-injection",
  "ambient-memory-injection": "memory-injection",
  "ambient-memory-bloat": "memory-injection",
  "memory-index-injection": "memory-injection",
  "memory-index-reinjection": "memory-injection",
  "unsolicited-memory-index": "memory-injection",
  "unused-memory-index": "memory-injection",
  "unused-memory-injection": "memory-injection",
  "memory-bloat": "memory-injection",
  "memory-context-bloat": "memory-injection",

  // memory-index-bloat — sibling canonical: the MEMORY.md index file itself
  // has outgrown its budget. Remedy is pruning the index, not gating
  // injection — kept distinct from memory-injection on remedy framing.
  "oversized-memory-index": "memory-index-bloat",
  "memory-index-oversize": "memory-index-bloat",
  "memory-index-oversized": "memory-index-bloat",
  "memory-index-overflow": "memory-index-bloat",
  "memory-index-truncation": "memory-index-bloat",
  "memory-truncation": "memory-index-bloat",

  // system-reminder-noise — CLAUDE.md auto-injection variants (spot-checked:
  // painPoints describe harness-side directory-CLAUDE.md dumps) plus the
  // generic ambient/unsolicited family. Memory-flavoured ones went above.
  "claudemd-injection": "system-reminder-noise",
  "claudemd-bloat": "system-reminder-noise",
  "claudemd-dump": "system-reminder-noise",
  "claudemd-auto-inject": "system-reminder-noise",
  "claude-md-auto-injection": "system-reminder-noise",
  "auto-injected-claudemd": "system-reminder-noise",
  "irrelevant-claudemd": "system-reminder-noise",
  "irrelevant-claudemd-injection": "system-reminder-noise",
  "directory-claudemd-injection": "system-reminder-noise",
  "unsolicited-injection": "system-reminder-noise",
  "unsolicited-context-bloat": "system-reminder-noise",
  "unsolicited-doc-injection": "system-reminder-noise",
  "ambient-context-bloat": "system-reminder-noise",
  "ambient-context-churn": "system-reminder-noise",
  "ambient-context-noise": "system-reminder-noise",
  "ambient-reminder-noise": "system-reminder-noise",
  "ambient-noise": "system-reminder-noise",
  "ambient-injection": "system-reminder-noise",
  "ambient-injection-noise": "system-reminder-noise",
  "ambient-injection-churn": "system-reminder-noise",
  "irrelevant-ambient-context": "system-reminder-noise",
  "irrelevant-context": "system-reminder-noise",
  "irrelevant-reminders": "system-reminder-noise",
  "irrelevant-tool-nudge": "system-reminder-noise",
  "context-injection-noise": "system-reminder-noise",
  "context-injection-bloat": "system-reminder-noise",
  "unused-context": "system-reminder-noise",
  "unused-injection": "system-reminder-noise",
  "reminder-noise": "system-reminder-noise",
  "system-reminder-repetition": "system-reminder-noise",
  "system-reminder-spam": "system-reminder-noise",
  "system-reminder-churn": "system-reminder-noise",

  // context-bloat — additional variants.
  "prompt-context-bloat": "context-bloat",
  "prompt-redundancy": "context-bloat",
  "redundant-context": "context-bloat",
  "redundant-restatement": "context-bloat",
  "context-waste": "context-bloat",
  "context-pollution": "context-bloat",
  "duplicated-context": "context-bloat",

  // prompt-duplication — NEW canonical: restating the same context into
  // subagent prompts. Distinct from context-bloat (received vs re-sent).
  "subagent-prompt-duplication": "prompt-duplication",
  "subagent-context-duplication": "prompt-duplication",

  // oversized-docs — the big Pass 3 fold. Spot-checked read-cap-truncation:
  // painPoints are "mental-model.md exceeds the 25k Read cap", i.e. the doc
  // is too big — cause-side fold per the Pass 1 read-cap precedent.
  "oversized-single-doc": "oversized-docs",
  "oversized-single-line-doc": "oversized-docs",
  "oversized-doc-line": "oversized-docs",
  "giant-line-doc": "oversized-docs",
  "giant-single-line-docs": "oversized-docs",
  "oversized-source-of-truth": "oversized-docs",
  "oversized-source-docs": "oversized-docs",
  "oversized-source-file": "oversized-docs",
  "oversized-files": "oversized-docs",
  "oversized-sot": "oversized-docs",
  "oversized-doc-truncation": "oversized-docs",
  "oversized-doc-read": "oversized-docs",
  "oversized-doc-navigation": "oversized-docs",
  "oversized-doc-pagination": "oversized-docs",
  "forced-paging": "oversized-docs",
  "context-paging": "oversized-docs",
  "context-paging-friction": "oversized-docs",
  "oversized-file-paging": "oversized-docs",
  "large-file-paging": "oversized-docs",
  "large-doc-truncation": "oversized-docs",
  "large-doc-navigation": "oversized-docs",
  "document-pagination": "oversized-docs",
  "documentation-paging": "oversized-docs",
  "mandatory-doc-paging": "oversized-docs",
  "file-paging-overhead": "oversized-docs",
  "doc-truncation": "oversized-docs",
  "mental-model-truncation": "oversized-docs",
  "read-cap-truncation": "oversized-docs",
  "read-truncation": "oversized-docs",
  "read-token-cap": "oversized-docs",
  "read-cap-vs-read-in-full": "oversized-docs",
  "full-read-forced": "oversized-docs",
  "full-read-required": "oversized-docs",
  "full-file-read": "oversized-docs",
  "read-file-truncation": "oversized-docs",
  "view-file-limits": "oversized-docs",
  "view-file-truncation": "oversized-docs",
  "file-viewing-limits": "oversized-docs",
  "godfile-navigation": "oversized-docs",
  "doc-section-extraction": "oversized-docs",
  "no-section-addressable-read": "oversized-docs",
  "no-section-index": "oversized-docs",
  "section-addressability": "oversized-docs",

  // tool-output-truncation — kept distinct from tool-output-noise in Pass 2
  // (cut off vs noisy); now a canonical target for output-side truncation.
  "output-truncation": "tool-output-truncation",
  "read-output-truncation": "tool-output-truncation",
  "search-result-truncation": "tool-output-truncation",
  "timeout-partial-result": "tool-output-truncation",

  // tool-output-noise — additional variants.
  "search-noise": "tool-output-noise",
  "grep-output-overflow": "tool-output-noise",
  "process-list-noise": "tool-output-noise",
  "process-check-noise": "tool-output-noise",
  "process-inspection": "tool-output-noise",
  "snapshot-verbosity": "tool-output-noise",
  "tool-output-volume": "tool-output-noise",
  "tool-output-bloat": "tool-output-noise",

  // write-guard-friction — NEW canonical: Edit/Write preconditions (read-
  // before-write, overwrite guard) firing on legitimately fresh files.
  "write-requires-prior-read": "write-guard-friction",
  "write-overwrite-guard": "write-guard-friction",
  "write-guard-false-positive": "write-guard-friction",
  "write-tool-precondition": "write-guard-friction",
  "edit-requires-read": "write-guard-friction",
  "read-before-edit-gate": "write-guard-friction",
  "stale-file-state": "write-guard-friction",

  // temp-file-friction — NEW canonical: /tmp scratch-file lifecycle pain
  // (stale survivors, collisions, blocked writes).
  "scratch-file-friction": "temp-file-friction",
  "temp-file-workaround": "temp-file-friction",
  "temp-file-creation": "temp-file-friction",
  "temp-file-collision": "temp-file-friction",
  "temp-file-write-blocked": "temp-file-friction",
  "stale-temp-file": "temp-file-friction",
  "stale-tmp-file": "temp-file-friction",
  "jobs-file-workaround": "temp-file-friction",

  // uninformative-error — NEW canonical: error/exit signals that don't say
  // what actually went wrong.
  "error-message-uninformative": "uninformative-error",
  "errorMessageUninformative": "uninformative-error",
  "uninformative-exit-code": "uninformative-error",
  "uninformative-failure": "uninformative-error",
  "misleading-error": "uninformative-error",
  "opaque-failure-signal": "uninformative-error",

  // tool-failed-recovered — canonical for the rubric-style "a tool failed and
  // I recovered in-turn" report. Spot-checked: 25/43 are NOT the write-guard
  // story (cwd persistence, escaping, grep misses), so it stays generic
  // rather than folding into write-guard-friction.
  "tool-recovered-same-turn": "tool-failed-recovered",
  "tool-failed-recovered-same-turn": "tool-failed-recovered",
  "recovered-same-turn": "tool-failed-recovered",

  // intent-conflict — additional variants incl. the authority/precedence
  // family (which instruction wins). Sub-topic markers
  // (intent-conflict-commit-policy, intent-conflict-workflow-keyword,
  // status-update-policy) stay distinct.
  "intent-conflict-framework-vs-northstar": "intent-conflict",
  "intent-conflict-framework-vs-adr": "intent-conflict",
  "intent-conflict-harness-vs-role": "intent-conflict",
  "intent-conflict-template-vs-northstar": "intent-conflict",
  "intent-conflict-template-vs-task": "intent-conflict",
  "intent-conflict-role-vs-assignment": "intent-conflict",
  "intent-conflict-injected-steer": "intent-conflict",
  "instruction-precedence": "intent-conflict",
  "instruction-precedence-conflict": "intent-conflict",
  "instruction-priority-conflict": "intent-conflict",
  "authority-conflict": "intent-conflict",
  "authority-precedence": "intent-conflict",
  "authority-ambiguity": "intent-conflict",

  // status-update-policy — sub-topic canonical retained; fold its variant.
  "status-update-conflict": "status-update-policy",

  // commentary-policy — NEW sub-topic canonical (sibling of
  // status-update-policy).
  "commentary-policy-conflict": "commentary-policy",
  "commentary-cadence": "commentary-policy",

  // decision-framework-gap — additional variants (incl. camelCase stray).
  // decision-framework-rigidity kept distinct (opposite complaint direction).
  "decisionframework-ambiguous": "decision-framework-gap",
  "decision-framework-absent": "decision-framework-gap",

  // input-shape-mismatch — contract-side additions (schema/api mismatch,
  // schema lookup mid-task). Generic marshaling follows the Pass 2
  // cli-argv-marshalling precedent.
  "inputShapeMismatch": "input-shape-mismatch",
  "subagent-api-mismatch": "input-shape-mismatch",
  "agent-tool-contract-mismatch": "input-shape-mismatch",
  "multi-agent-schema-mismatch": "input-shape-mismatch",
  "orchestration-schema-mismatch": "input-shape-mismatch",
  "orchestration-api-mismatch": "input-shape-mismatch",
  "tool-schema-discovery": "input-shape-mismatch",
  "tool-schema-lookup-required": "input-shape-mismatch",
  "schema-lookup-mid-task": "input-shape-mismatch",
  "cli-argv-marshaling": "input-shape-mismatch",
  "cli-input-marshalling": "input-shape-mismatch",
  "argv-marshaling": "input-shape-mismatch",
  "argv-marshalling": "input-shape-mismatch",
  "browsertools-eval-shape": "input-shape-mismatch",

  // cli-shell-escaping — shell-mechanics additions (json/string/prose/
  // escaping-flavoured marshaling).
  "cli-json-marshaling": "cli-shell-escaping",
  "cli-json-marshalling": "cli-shell-escaping",
  "cli-argv-json-marshalling": "cli-shell-escaping",
  "cli-json-argv-marshalling": "cli-shell-escaping",
  "argv-json-escaping": "cli-shell-escaping",
  "argv-json-marshalling": "cli-shell-escaping",
  "argv-json": "cli-shell-escaping",
  "argv-string-marshaling": "cli-shell-escaping",
  "cli-flat-string-marshaling": "cli-shell-escaping",
  "cli-flat-string-args": "cli-shell-escaping",
  "cli-string-marshalling": "cli-shell-escaping",
  "cli-stringified-json": "cli-shell-escaping",
  "json-argv-marshaling": "cli-shell-escaping",
  "json-argv-escaping": "cli-shell-escaping",
  "stringified-json": "cli-shell-escaping",
  "prose-in-argv": "cli-shell-escaping",
  "cli-argv-blob": "cli-shell-escaping",
  "manual-newline-escaping": "cli-shell-escaping",
  "heredoc-workaround": "cli-shell-escaping",
  "escaping-workaround": "cli-shell-escaping",
  "shell-quoting-friction": "cli-shell-escaping",
  "cli-argv-prose-marshaling": "cli-shell-escaping",
  "argv-prose-marshalling": "cli-shell-escaping",
  "multiline-context-marshalling": "cli-shell-escaping",
  "cli-context-marshaling": "cli-shell-escaping",
  "cli-context-marshalling": "cli-shell-escaping",
  "context-marshaling": "cli-shell-escaping",
  "tool-input-marshalling": "cli-shell-escaping",

  // mcp-churn — additional variants.
  "mcp-connect-disconnect-churn": "mcp-churn",
  "mcp-connect-disconnect-noise": "mcp-churn",
  "mcp-churn-noise": "mcp-churn",
  "mcp-flapping": "mcp-churn",
  "mcp-lifecycle-chatter": "mcp-churn",
  "mcp-availability-churn": "mcp-churn",
  "mcp-tool-churn": "mcp-churn",
  "ambient-mcp-churn": "mcp-churn",

  // deferred-tool-noise — additional variants (roundtrip/discovery framing).
  "tool-discovery-friction": "deferred-tool-noise",
  "tool-discovery": "deferred-tool-noise",
  "tool-roundtrip-overhead": "deferred-tool-noise",
  "deferred-tool-injection": "deferred-tool-noise",

  // subagent-verification-overhead — additional variants.
  "subagent-report-verification": "subagent-verification-overhead",
  "subagent-verification": "subagent-verification-overhead",
  "subagent-report-trust": "subagent-verification-overhead",
  "report-trust-gap": "subagent-verification-overhead",
  "report-verification": "subagent-verification-overhead",
  "unverifiable-claims": "subagent-verification-overhead",
  "claim-verification-cost": "subagent-verification-overhead",
  "claim-verification-overhead": "subagent-verification-overhead",
  "claim-verification-manual": "subagent-verification-overhead",
  "manual-claim-verification": "subagent-verification-overhead",
  "redundant-verification": "subagent-verification-overhead",

  // verification-overhead — generic canonical, still distinct from the
  // subagent flavour per Pass 2 (spot-check confirms mixed non-subagent uses).
  "verification-burden": "verification-overhead",
  "verification-cost": "verification-overhead",

  // verify-dont-inherit — NEW canonical: the cost of the repo-mandated
  // "verify, don't inherit" diligence. Kept visible as its own theme.
  "verify-dont-inherit-cost": "verify-dont-inherit",
  "verify-dont-inherit-tax": "verify-dont-inherit",
  "verify-not-inherit": "verify-dont-inherit",
  "verify-dont-trust": "verify-dont-inherit",
  "trust-but-verify": "verify-dont-inherit",
  "trust-but-verify-cost": "verify-dont-inherit",

  // subagent-opacity — NEW canonical: can't see what subagents are doing
  // in-flight. Cause-side complement of subagent-verification-overhead.
  "subagent-progress-opacity": "subagent-opacity",
  "agent-progress-opacity": "subagent-opacity",
  "subagent-observability": "subagent-opacity",
  "agent-lifecycle-opacity": "subagent-opacity",
  "subagent-lifecycle": "subagent-opacity",
  "agent-lifecycle": "subagent-opacity",

  // shared-worktree-race — additional variants.
  "shared-worktree-races": "shared-worktree-race",
  "shared-workspace-race": "shared-worktree-race",
  "shared-worktree-risk": "shared-worktree-race",
  "shared-worktree-contention": "shared-worktree-race",
  "shared-worktree-coordination": "shared-worktree-race",
  "shared-worktree-drift": "shared-worktree-race",
  "concurrent-worktree-drift": "shared-worktree-race",
  "shared-worktree-provenance": "shared-worktree-race",
  "shared-worktree-noise": "shared-worktree-race",
  "change-attribution": "shared-worktree-race",
  "working-tree-drift": "shared-worktree-race",

  // dirty-worktree — additional variants.
  "dirty-worktree-provenance": "dirty-worktree",
  "git-status-noise": "dirty-worktree",
  "dirty-state-ambiguity": "dirty-worktree",

  // parallel-dispatch — additional variants.
  "parallel-reads-missed": "parallel-dispatch",
  "parallel-dispatch-friction": "parallel-dispatch",
  "parallel-dispatch-blocked": "parallel-dispatch",
  "sequential-file-reads": "parallel-dispatch",
  "batched-read-ergonomics": "parallel-dispatch",

  // redundant-reads — NEW canonical: re-reading files already in context.
  "repeat-reads": "redundant-reads",
  "duplicate-file-reads": "redundant-reads",
  "redundant-read": "redundant-reads",

  // polling-overhead — NEW canonical: manual polling of background/long
  // commands. nested-session flavour folded under nested-session-friction.
  "background-task-polling": "polling-overhead",
  "background-process-polling": "polling-overhead",
  "long-running-command-polling": "polling-overhead",
  "background-wait-ergonomics": "polling-overhead",
  "long-running-command-ergonomics": "polling-overhead",

  // nested-session-friction — NEW canonical: driving nested/async workflow
  // sessions (polling them, indirection).
  "nested-session-polling": "nested-session-friction",
  "nested-session-ergonomics": "nested-session-friction",
  "async-session-indirection": "nested-session-friction",

  // validation-* — additions to the Pass 2 canonicals.
  "validation-polling": "validation-ergonomics",
  "validation-progress-opacity": "validation-ergonomics",
  "validation-policy": "validation-policy-ambiguity",
  "validation-gate-ambiguity": "validation-policy-ambiguity",
  "test-output-noise": "validation-output-noise",
  "test-log-noise": "validation-output-noise",
  "warning-noise": "validation-output-noise",

  // validation-duplication — NEW canonical: the same validation run twice
  // across gates/agents.
  "redundant-validation": "validation-duplication",
  "duplicate-validation": "validation-duplication",
  "validation-redundancy": "validation-duplication",
  "redundant-revalidation": "validation-duplication",

  // validation-trust — named distinct in Pass 2; now a canonical target for
  // the "can I believe the green" family.
  "validation-trust-gap": "validation-trust",
  "false-green-risk": "validation-trust",
  "false-green": "validation-trust",
  "validation-flakiness": "validation-trust",

  // kludged-bash — additional variants. missing-dedicated-tool stays the
  // distinct cause-side canonical; fold its synonym.
  "bash-kludge": "kludged-bash",
  "kludged-bash-parsing": "kludged-bash",
  "kludged-bash-grep": "kludged-bash",
  "shell-pipeline-overhead": "kludged-bash",
  "no-dedicated-tool": "missing-dedicated-tool",

  // bash-cwd-persistence — canonical for the harness cwd-carryover surprise.
  "shell-cwd-persistence": "bash-cwd-persistence",
  "cwd-persistence": "bash-cwd-persistence",

  // calibration-overhead — NEW canonical: cost of AOP.CALIBRATE at session
  // start. aop-overbreadth (doc too broad) kept distinct; fold its variant.
  "aop-calibrate-overhead": "calibration-overhead",
  "calibration-cost": "calibration-overhead",
  "repeated-calibration": "calibration-overhead",
  "calibration-overbreadth": "aop-overbreadth",

  // artifact-readback — additional variants (readback/scan/keyed-access
  // framing).
  "artifact-blob-readback": "artifact-readback",
  "flat-blob-readback": "artifact-readback",
  "flat-prose-readback": "artifact-readback",
  "flat-decision-blob-readback": "artifact-readback",
  "flat-prose-artifact-readback": "artifact-readback",
  "no-key-based-readback": "artifact-readback",
  "key-based-readback-missing": "artifact-readback",
  "artifact-readback-no-keys": "artifact-readback",
  "no-key-access": "artifact-readback",
  "no-key-index": "artifact-readback",
  "artifact-scan": "artifact-readback",
  "artifact-discoverability": "artifact-readback",
  "artifact-discovery": "artifact-readback",
  "decision-record-scan": "artifact-readback",
  "decision-record-scanning": "artifact-readback",
  "decision-log-scan": "artifact-readback",
  "linear-scan": "artifact-readback",
  "prose-blob-parsing": "artifact-readback",

  // flat-prose-blob — additional variants (shape-side framing).
  "decision-record-flat-blob": "flat-prose-blob",
  "flat-decisions-blob": "flat-prose-blob",
  "flat-prose-artifact-blob": "flat-prose-blob",
  "flat-context-blob": "flat-prose-blob",
  "artifacts-decisions-flat-blob": "flat-prose-blob",
  "flat-artifacts-blob": "flat-prose-blob",
  "prose-blob": "flat-prose-blob",
  "flat-prose-blobs": "flat-prose-blob",
  "flat-prose-decision-blob": "flat-prose-blob",
  "flat-decision-ledger": "flat-prose-blob",
  "flat-prose-ledger": "flat-prose-blob",
  "flat-prose-state": "flat-prose-blob",
  "flat-artifact-prose": "flat-prose-blob",
  "structured-data-flattening": "flat-prose-blob",
  "decision-record-bloat": "flat-prose-blob",
  "artifact-bloat": "flat-prose-blob",

  // line-reference-friction — additional variants.
  "stale-line-anchors": "line-reference-friction",
  "stale-line-references": "line-reference-friction",
  "line-anchor-drift": "line-reference-friction",
  "line-evidence-friction": "line-reference-friction",

  // path-discovery-friction — NEW canonical: figuring out where things live
  // (workspace roots, paths, repo shape).
  "workspace-discovery-friction": "path-discovery-friction",
  "path-discovery": "path-discovery-friction",
  "workspace-path-discovery": "path-discovery-friction",
  "path-resolution-friction": "path-discovery-friction",
  "workspace-path-mismatch": "path-discovery-friction",
  "workspace-detection-failure": "path-discovery-friction",
  "repo-shape-discovery": "path-discovery-friction",

  // code-navigation-friction — NEW canonical: navigating source without
  // goto-def-grade tooling.
  "source-navigation-friction": "code-navigation-friction",
  "source-navigation": "code-navigation-friction",

  // source-of-truth-duplication — NEW canonical: the same truth maintained in
  // multiple places (and disagreeing).
  "duplicate-source-of-truth": "source-of-truth-duplication",
  "duplicated-source-of-truth": "source-of-truth-duplication",
  "source-of-truth-sprawl": "source-of-truth-duplication",
  "source-of-truth-fragmentation": "source-of-truth-duplication",
  "duplicated-authority": "source-of-truth-duplication",

  // dev-server-corruption — canonical for unreliable dev-server state.
  "stale-dev-server": "dev-server-corruption",
  "dev-server-brittleness": "dev-server-corruption",

  // uid-churn — canonical for browsertools snapshot UIDs churning between
  // snapshots.
  "browsertools-uid-churn": "uid-churn",
  "snapshot-uid-churn": "uid-churn",

  // workflow-keyword-misfire — NEW canonical: workflow keyword triggers
  // firing on false positives.
  "workflow-keyword-false-positive": "workflow-keyword-misfire",
  "workflow-keyword-false-trigger": "workflow-keyword-misfire",
  "false-keyword-trigger": "workflow-keyword-misfire",
  "keyword-trigger-false-positive": "workflow-keyword-misfire",
  "workflow-keyword-nudge": "workflow-keyword-misfire",

  // task-tool-reminder-noise / silent-reconciliation — stragglers.
  "task-tool-nudge": "task-tool-reminder-noise",
  "silent-override": "silent-reconciliation",

  // hidden-fanout — canonical for fan-out happening without being asked.
  "implicit-fanout": "hidden-fanout",

  // review-split-verdict — NEW canonical: reviewers disagreeing / split
  // verdicts needing adjudication.
  "split-verdict-mapping": "review-split-verdict",
  "reviewer-split": "review-split-verdict",
  "split-review-verdict": "review-split-verdict",
  "reviewer-disagreement": "review-split-verdict",

  // review-vs-implement-mapping — NEW canonical: mapping review-stage
  // feedback onto implementation scope.
  "review-vs-implement": "review-vs-implement-mapping",
  "plan-review-vs-code-review": "review-vs-implement-mapping",

  // append-only-growth — canonical for files that only ever grow.
  "unbounded-append": "append-only-growth",

  // orchestration-friction — additional variant.
  "orchestration-overhead": "orchestration-friction",

  // ===========================================================================
  // Pass 4 additions (2026-11-11) — ~13 weeks since Pass 3; 576 rows in the
  // last month alone, 377 keyword slots still on pre-Pass-3 spellings.
  // ===========================================================================

  // tool-output-truncation — V2 canonical retained; now the #2 theme. The
  // harness cut the output off (Claude persists >~30KB Bash output to a file,
  // Codex caps the outer functions.exec budget). Tool-side framing. Kept
  // distinct from oversized-docs (shape-side: the doc is too big) — same
  // precedent as artifact-readback vs flat-prose-blob. Job-RESULT truncation
  // (a timed-out job's digest) is a different mechanism → job-timeout-handoff.
  "nested-output-budgets": "tool-output-truncation",
  "nested-output-truncation": "tool-output-truncation",
  "nested-output-limits": "tool-output-truncation",
  "tool-output-overflow": "tool-output-truncation",
  "tool-output-limit": "tool-output-truncation",
  "tool-output-limits": "tool-output-truncation",
  "tool-output-cap": "tool-output-truncation",
  "tool-output-spill": "tool-output-truncation",
  "unbounded-tool-output": "tool-output-truncation",
  "output-truncation": "tool-output-truncation",
  "doc-output-truncation": "tool-output-truncation",
  "document-output-truncation": "tool-output-truncation",
  "document-truncation": "tool-output-truncation",
  "doc-read-truncation": "tool-output-truncation",
  "oversized-doc-output-truncation": "tool-output-truncation",
  "oversized-doc-output-limit": "tool-output-truncation",
  "oversized-spec-truncation": "tool-output-truncation",
  "required-doc-truncation": "tool-output-truncation",
  "validate-output-truncation": "tool-output-truncation",
  "persisted-output-truncation": "tool-output-truncation",
  "batch-output-budget": "tool-output-truncation",
  // read-batching — NEW canonical (Codex-leaning cause): combining several
  // long reads into one exec so the combined output blows the budget.
  // Cause-side of tool-output-truncation; kept distinct (remedy is "one doc
  // per call", not "raise the cap").
  "read-batch-sizing": "read-batching",
  "read-budget-mismatch": "read-batching",
  "read-budget-ergonomics": "read-batching",
  "batched-read-overflow": "read-batching",
  "oversized-read-batches": "read-batching",
  // oversized-docs — additional variants.
  "oversized-doc-output": "oversized-docs",
  "oversized-document-reads": "oversized-docs",
  "oversized-doc-reads": "oversized-docs",
  "oversized-doc-spill": "oversized-docs",
  "oversized-spec-output": "oversized-docs",
  "oversized-doc-read": "oversized-docs",
  "large-doc-read": "oversized-docs",
  "large-spec-paging": "oversized-docs",
  "large-generated-doc-navigation": "oversized-docs",
  "documentation-sprawl": "oversized-docs",
  "receipt-doc-bloat": "oversized-docs",
  "doc-read-budget": "oversized-docs",
  // append-only-growth — additional variants (completion.md accreting review
  // rounds is the recurring instance).
  "append-only-doc-growth": "append-only-growth",
  "append-only-doc-bloat": "append-only-growth",
  // redundant-reads — NEW canonical: same file read more than once in one
  // job (rubric sameFileReadMultipleTimes is the presence check).
  "repeated-file-reads": "redundant-reads",
  "repeated-context-reads": "redundant-reads",
  "repeated-document-reads": "redundant-reads",
  "repeated-read-overhead": "redundant-reads",
  "avoidable-rereads": "redundant-reads",
  "read-before-edit-redundancy": "redundant-reads",

  // hidden-fanout — Pass 3 canonical retained (Claude PM only): one `review`
  // entry silently expands to every configured reviewer harness; the PM wrote
  // the brief for one reviewer. hidden-job-fanout is now the louder spelling
  // (19 vs 6) but cross-pass continuity wins. Distinct from parallel-dispatch
  // (missed parallelism) and from concurrent-writer-collision (the effect).
  "hidden-job-fanout": "hidden-fanout",
  "implicit-job-fanout": "hidden-fanout",
  "silent-job-fanout": "hidden-fanout",
  "silent-fanout": "hidden-fanout",
  "hidden-harness-fanout": "hidden-fanout",
  "insert-job-silent-fanout": "hidden-fanout",
  "insert-job-hidden-fanout": "hidden-fanout",
  "insert-job-opaque-expansion": "hidden-fanout",
  "harness-assignment-opacity": "hidden-fanout",
  "harness-assignment-opaque": "hidden-fanout",
  "harness-routing-opacity": "hidden-fanout",
  // job-grouping-footgun — NEW canonical: implement and review placed in one
  // parallel group so reviewers race the implementer. Kept distinct from
  // hidden-job-fanout (the PM knew they were parallel; they didn't know
  // the group semantics).
  "job-group-parallelism-footgun": "job-grouping-footgun",

  // shared-worktree-race — additional variants (general theme).
  "shared-worktree-drift": "shared-worktree-race",
  "shared-worktree-coordination": "shared-worktree-race",
  "shared-worktree-contention": "shared-worktree-race",
  "shared-worktree-interference": "shared-worktree-race",
  "shared-worktree-contamination": "shared-worktree-race",
  "shared-worktree-file-contention": "shared-worktree-race",
  "shared-workspace-concurrency": "shared-worktree-race",
  "concurrent-head-mutation": "shared-worktree-race",
  "concurrent-job-interference": "shared-worktree-race",
  "environment-contention": "shared-worktree-race",
  "shared-environment-contention": "shared-worktree-race",
  "moving-review-target": "shared-worktree-race",
  "mutable-review-target": "shared-worktree-race",
  // concurrent-writer-collision — NEW canonical, the specific recurring
  // sub-topic: two agents (usually fan-out reviewers) editing the SAME file
  // or output path. General-vs-specific precedent — stays distinct from
  // shared-worktree-race.
  "concurrent-agent-collision": "concurrent-writer-collision",
  "parallel-writer-collision": "concurrent-writer-collision",
  "parallel-output-collision": "concurrent-writer-collision",
  "output-path-collision": "concurrent-writer-collision",
  "concurrent-edit-visibility": "concurrent-writer-collision",
  "concurrent-edit-risk": "concurrent-writer-collision",
  "concurrent-edit-collision": "concurrent-writer-collision",
  "concurrent-write-collision": "concurrent-writer-collision",
  "concurrent-file-mutation": "concurrent-writer-collision",
  "concurrent-session-collision": "concurrent-writer-collision",
  "concurrent-reviewer-edits": "concurrent-writer-collision",
  "concurrent-reviewer-collision": "concurrent-writer-collision",
  "concurrent-review-collision": "concurrent-writer-collision",
  "concurrent-reviewer-drift": "concurrent-writer-collision",
  "edit-collision": "concurrent-writer-collision",
  "silent-overwrite": "concurrent-writer-collision",
  "fanout-shared-artifact": "concurrent-writer-collision",
  // shared-build-artifact-collision — NEW canonical: validate's build and the
  // dev server share one output dir (.next). Remedy is an isolated distDir,
  // nothing to do with file edits → distinct from the two above.
  "shared-build-directory": "shared-build-artifact-collision",
  "shared-build-dir": "shared-build-artifact-collision",
  "shared-build-dir-clobber": "shared-build-artifact-collision",
  "shared-build-artifacts": "shared-build-artifact-collision",
  "shared-build-output": "shared-build-artifact-collision",
  "dev-build-state-collision": "shared-build-artifact-collision",
  "shared-generator-race": "shared-build-artifact-collision",
  // dirty-worktree — additional variants (inherited dirt, attribution of it).
  "dirty-shared-worktree": "dirty-worktree",
  "dirty-tree-provenance": "dirty-worktree",
  "dirty-tree-attribution": "dirty-worktree",
  "shared-worktree-attribution": "dirty-worktree",
  "shared-worktree-ownership": "dirty-worktree",
  "agent-change-attribution": "dirty-worktree",
  // id-collision — NEW canonical: D-ids, phase numbers, test ids allocated
  // by hand collide across assignment Decisions, phase specs and parallel
  // reviewers.
  "decision-id-collision": "id-collision",
  "decision-id-namespace-collision": "id-collision",
  "id-namespace-collision": "id-collision",
  "phase-id-collision": "id-collision",
  "finding-id-collision": "id-collision",
  "manual-id-allocation": "id-collision",
  "identifier-ambiguity": "id-collision",

  // calibration-overhead — NEW canonical: AOP.CALIBRATE's full-read mandate
  // applied to a narrow PM/review job. Behavioural tell in the rows: "so I
  // skipped it" — a silent deviation, not a relevance whinge. Kept distinct
  // from oversized-docs (doc size) and from duplicated-calibration (subagents
  // re-calibrating independently).
  "calibrate-overhead": "calibration-overhead",
  "calibrate-overreach": "calibration-overhead",
  "aop-calibrate-overreach": "calibration-overhead",
  "aop-calibrate-overscoped-for-pm": "calibration-overhead",
  "unbounded-calibration": "calibration-overhead",
  "calibrate-scope-mismatch": "calibration-overhead",
  "calibrate-cost-vs-pm-scope": "calibration-overhead",
  "intent-conflict-calibrate-vs-pm-scope": "calibration-overhead",
  "calibration-scope-overload": "calibration-overhead",
  "calibration-cost": "calibration-overhead",
  "overbroad-calibration": "calibration-overhead",
  "calibrate-overhead-mismatch": "calibration-overhead",
  "oversized-calibration": "calibration-overhead",
  "mandatory-doc-overread": "calibration-overhead",
  "mandatory-reading-overload": "calibration-overhead",

  // polling-overhead — NEW canonical: hand-rolled nohup/pgrep/sleep loops
  // around a validate run longer than the foreground Bash cap, with no
  // deterministic status/wait primitive.
  "active-polling-overhead": "polling-overhead",
  "active-polling-rule-overhead": "polling-overhead",
  "polling-ergonomics": "polling-overhead",
  "polling-friction": "polling-overhead",
  "manual-polling": "polling-overhead",
  "idle-wait-ergonomics": "polling-overhead",
  "background-task-polling": "polling-overhead",
  "background-process-polling": "polling-overhead",
  "background-task-monitoring": "polling-overhead",
  "task-monitoring-overhead": "polling-overhead",
  "sibling-job-polling-overhead": "polling-overhead",
  "long-validate-polling": "polling-overhead",
  "long-gate-wait-ergonomics": "polling-overhead",
  "long-running-gate-ergonomics": "polling-overhead",
  "long-running-tool-ergonomics": "polling-overhead",
  // validation-observability — NEW canonical: validate is silent inside a
  // gate and --status reports the last finished run, not the active one.
  // Cause of polling-overhead; kept distinct (remedy lives in the CLI).
  "validation-observability-gap": "validation-observability",
  "validation-progress-blindness": "validation-observability",
  "validation-feedback-latency": "validation-observability",
  "validation-diagnostic-latency": "validation-observability",
  "stale-status-reporting": "validation-observability",
  "stale-status-readback": "validation-observability",
  "stale-status": "validation-observability",
  "single-flight-opacity": "validation-observability",
  "single-flight-observability": "validation-observability",
  "single-flight-ambiguity": "validation-observability",
  "single-flight-gap": "validation-observability",
  // validation-ergonomics — additional variants.
  "validate-exceeds-bash-timeout": "validation-ergonomics",
  "long-blocking-validate": "validation-ergonomics",
  "long-running-gate": "validation-ergonomics",
  "long-running-cli": "validation-ergonomics",
  "validation-cost": "validation-ergonomics",
  // validation-duplication — V2 canonical retained: the PM re-runs a full
  // validate when a crew receipt at the same HEAD already exists.
  "validate-receipt-trust": "validation-duplication",
  "receipt-trust": "validation-duplication",
  "receipt-version-ambiguity": "validation-duplication",
  "redundant-long-run": "validation-duplication",
  "duplicate-execution": "validation-duplication",
  // validation-policy-ambiguity — additional variants: which validation
  // applies to a fenced (read-only / docs-only / no-runners) job.
  "validation-scope-mismatch": "validation-policy-ambiguity",
  "validation-scope-conflict": "validation-policy-ambiguity",
  "validation-mode-ambiguity": "validation-policy-ambiguity",
  "validation-ownership-ambiguity": "validation-policy-ambiguity",
  "validate-gate-ambiguity": "validation-policy-ambiguity",
  "validate-gate-docs-only-ambiguity": "validation-policy-ambiguity",
  "docs-only-validate": "validation-policy-ambiguity",
  "premature-validation": "validation-policy-ambiguity",
  // validation-fragmentation — NEW canonical: the gate is N separate runner
  // invocations with no single manifest (namespace-side config smell).
  "test-runner-fragmentation": "validation-fragmentation",
  // validation-output-noise — additional variants.
  "validate-output-verbosity": "validation-output-noise",
  "validate-noise": "validation-output-noise",
  "validation-signal-noise": "validation-output-noise",
  "known-red-gate-noise": "validation-output-noise",
  "known-environment-failure-noise": "validation-output-noise",
  // known-env-gate-failure — NEW canonical (cause-side of the noise above):
  // a gate is permanently red for an environmental reason every job must
  // re-diagnose. Remedy is an allowlist, not quieter logs → distinct.
  "known-environmental-gate-failure": "known-env-gate-failure",
  "known-environment-failure": "known-env-gate-failure",
  "known-env-failure-not-allowlisted": "known-env-gate-failure",
  "environmental-gate-failure": "known-env-gate-failure",
  "environmental-false-failure": "known-env-gate-failure",
  "validate-environmental-failure": "known-env-gate-failure",
  "validate-gate-permanent-red": "known-env-gate-failure",
  "false-red-gate": "known-env-gate-failure",
  "unrelated-gate-failure": "known-env-gate-failure",
  "external-dependency-false-positive": "known-env-gate-failure",

  // intent-conflict — additional pair-named variants, folded per the
  // existing precedent (aop-vs-assignment already folds). The pair survives
  // in items[].painPoint for slice reading.
  "intent-conflict-aop-vs-pm-role": "intent-conflict",
  "intent-conflict-aop-vs-pm-scope": "intent-conflict",
  "intent-conflict-northstar-vs-mental-model": "intent-conflict",
  "intent-conflict-northstar-internal": "intent-conflict",
  "intent-conflict-northstar-vs-nudge": "intent-conflict",
  "intent-conflict-spec-vs-guide": "intent-conflict",
  "intent-conflict-framework-vs-nudge": "intent-conflict",
  "intent-conflict-template-vs-scope-fence": "intent-conflict",
  "instruction-scope-conflict": "intent-conflict",
  "instruction-precedence-friction": "intent-conflict",
  "instruction-contradiction": "intent-conflict",
  "instruction-tool-contract-mismatch": "intent-conflict",
  "aop-scope-mismatch": "intent-conflict",
  // superseded-context-unmarked — NEW canonical: prompts carry superseded
  // rulings/reviews phrased as still-mandatory. Distinct from intent-conflict
  // (the sources don't disagree; one is just stale) and from
  // decision-log-bloat (size, not staleness).
  "superseded-instructions": "superseded-context-unmarked",
  "superseded-decisions-unmarked": "superseded-context-unmarked",
  "superseded-decision-context": "superseded-context-unmarked",
  "decision-log-supersession": "superseded-context-unmarked",
  "historical-requirement-overload": "superseded-context-unmarked",
  "stale-prior-output-in-prompt": "superseded-context-unmarked",
  // review-split-verdict — Pass 3 canonical retained, a decision-framework
  // sub-topic: the fan-out panel disagrees and post-review has no
  // aggregation rule.
  "conflicting-reviewer-verdicts": "review-split-verdict",
  "split-review-verdict-aggregation": "review-split-verdict",
  "review-quorum-undefined": "review-split-verdict",
  // decision-log-bloat — NEW canonical (size of the Decisions ledger).
  "decision-log-growth": "decision-log-bloat",
  "decision-log-churn": "decision-log-bloat",
  // artifact-readback / flat-prose-blob — additional variants.
  "decision-retrieval-friction": "artifact-readback",
  "decision-log-scan-cost": "artifact-readback",
  "flat-context-readback": "artifact-readback",
  "decision-record-flat-prose": "flat-prose-blob",
  "unstructured-decision-history": "flat-prose-blob",
  "decision-record-fragmentation": "flat-prose-blob",

  // stale-nudge — NEW canonical (Claude PM only): pmNudge carries no
  // timestamp or SHA, so the PM can't tell new guidance from absorbed.
  "nudge-lifecycle": "stale-nudge",
  "nudge-lifecycle-ambiguity": "stale-nudge",
  "nudge-metadata-missing": "stale-nudge",

  // headless-status-nudge-noise — NEW canonical: the harness's "user hasn't
  // heard from you" reminder firing in an unattended job. Harness-side
  // injection, but a named recurring sub-topic (todowrite-noise precedent).
  "headless-status-nudges": "headless-status-nudge-noise",
  "headless-progress-nudge-noise": "headless-status-nudge-noise",
  "headless-interruptions": "headless-status-nudge-noise",
  // progress-update-noise — NEW canonical (Codex-leaning): a mandated
  // sub-minute commentary cadence during a silent long gate. Effect-side of
  // status-update-policy (the intent conflict), kept distinct.
  "forced-progress-noise": "progress-update-noise",
  "forced-progress-chatter": "progress-update-noise",
  "status-update-churn": "progress-update-noise",
  "status-update-pressure": "progress-update-noise",
  "status-message-churn": "progress-update-noise",
  "progress-update-pressure": "progress-update-noise",
  "heartbeat-noise": "progress-update-noise",
  "heartbeat-nudge-noise": "progress-update-noise",
  "low-information-updates": "progress-update-noise",
  // cwd-drift — NEW canonical: a `cd` inside a compound Bash call persists
  // and the harness injects an environment-update notice.
  "cwd-drift-notices": "cwd-drift",
  "persistent-cwd-surprise": "cwd-drift",
  "bash-state-surprise": "cwd-drift",
  // pkill-self-match — NEW canonical: `pkill -f <pattern>` matches the
  // agent's own bash -c string and kills its shell.
  "process-kill-self-match": "pkill-self-match",
  // dev-server-lifecycle — NEW canonical: no managed start/stop/restart for
  // the dev server; nohup'd processes vanish or orphan.
  "background-process-lifecycle": "dev-server-lifecycle",
  "background-process-lifetime": "dev-server-lifecycle",
  "orphaned-background-process": "dev-server-lifecycle",
  "process-lifecycle": "dev-server-lifecycle",
  "dev-server-restart": "dev-server-lifecycle",

  // job-timeout-handoff — NEW canonical (Claude PM only): a job that hit its
  // wall-clock limit hands the PM a truncated chatter tail with no final
  // state. Runner-side mechanism; NOT tool-output-truncation.
  "truncated-job-output": "job-timeout-handoff",
  "truncated-job-report": "job-timeout-handoff",
  "timeout-handoff-loss": "job-timeout-handoff",
  "opaque-job-failure": "job-timeout-handoff",
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

  // Cursor-batched loop — the table exceeds the 8 MiB per-transaction read
  // limit, so the mutation processes one page per call.
  let cursor: string | null = null;
  let scanned = 0;
  let updated = 0;
  for (;;) {
    const result: {
      scanned: number;
      updated: number;
      isDone: boolean;
      continueCursor: string | null;
    } = await client.mutation(api.reflectionsV2.normalizeKeywords, {
      password: config.password,
      mapping: MAPPING,
      cursor,
      batchSize: 200,
    });
    scanned += result.scanned;
    updated += result.updated;
    console.log(
      `batch: scanned=${result.scanned} updated=${result.updated} (total ${scanned}/${updated})`
    );
    if (result.isDone) break;
    cursor = result.continueCursor;
  }
  console.log(`Done. Scanned ${scanned}, updated ${updated}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
