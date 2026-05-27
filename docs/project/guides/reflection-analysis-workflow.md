# Reflection Analysis Workflow — The Steward Loop

The Outcome Steward owns the reflection data: agents write raw, free-form keywords at capture time; the Steward canonicalises post-hoc and reads aggregates for what's loudest. This guide documents the routine loop.

The **why** layer (boolean rubric, free-form keywords, frequency-is-severity) lives in [`mental-model.md` §Agent Reflection Feedback Loop](../spec/mental-model.md). This is the **how**.

The cross-job interrogation procedure for a *specific* dispatch failure is a different workflow — see [`cross-job-postmortem.md`](cross-job-postmortem.md).

## When to run this loop

- A batch of new reflections has accumulated (rough rule of thumb: 50+ new entries since the last normalize pass, or whenever the long-tail of singletons feels untidy).
- Before any aggregate-driven decision (which themes are loudest? what's emerging?). Pre-normalize counts are misleading — same complaint spread across 20 spellings counts as 20 weak signals instead of one loud one.
- After a rubric or capture-shape change. New framing surfaces new keyword families; they need clustering.

Don't run this loop for a single-row drill (the postmortem flow handles that). Don't run it just to "tidy up" — every merge is lossy, and the long tail of singletons is genuine discovery output.

## The loop

```
dump → inventory → cluster long-tail → edit MAPPING → dry-run → apply → re-inventory → read aggregates
```

Each step uses an existing CLI. The mapping lives in source (`keywords-normalize-v2.ts`); re-runs are idempotent; mutations rewrite both top-level `keywords` AND each `items[].keywords` server-side.

### 1. Dump

```bash
npx tsx .agents/tools/workflow/introspection/dump-reflections-v2.ts \
  --output /tmp/reflections-v2-dump.json
```

Writes every V2 row across every namespace to one file. Use this when you need to look at painPoints for cluster disambiguation (step 3) — `inventory` only gives counts.

(V1 has its own parallel CLI: `dump-reflections.ts`. Use V2 for current-shape work; V1 only for historical analysis.)

### 2. Inventory

```bash
npx tsx .agents/tools/workflow/introspection/keywords-inventory-v2.ts --all --json \
  > /tmp/v2-kw-inventory.json
```

Counts entry-level keywords. Items-level counting is deliberately omitted — aggregate severity is measured at the entry level (an entry that breaks one theme into three items shouldn't count 3× for that theme).

Frequency buckets are the first read: how many keywords have count >=10, 5-9, 2-4, 1? The 1-bucket is the discovery tail and stays free-form. The 2+ buckets are the canonicalization candidates.

### 3. Cluster the long-tail (the judgment work)

This is the only manual step. Read down the sorted-by-count list and group same-complaint variants. The rest of the loop is mechanical.

**Merge** when:
- Spelling/casing variants of the same word (`todoWrite-noise` ↔ `todowrite-noise`).
- Synonyms of the same complaint (`shell-quoting` ↔ `shell-escaping`).
- Subset descriptors of the same theme (`artifact-readback-friction`, `artifact-readback-overhead`, `flat-artifact-readback` → all `artifact-readback`).
- Symptom-and-fix-pointer for the same underlying friction (`no-keyed-readback` is a fix-direction; `artifact-readback` is the symptom — merge, because the keyword should aggregate frequency of the same row-pattern).

**Keep distinct** when:
- The themes are **complements**, not synonyms — cause/effect or symptom/behaviour. Example: `intent-conflict` (different sources disagreed) and `silent-reconciliation` (the agent picked one without surfacing it) are a cause/behaviour pair. Items often tag both. Merging would erase the behavioural signal.
- The themes are **cause and workaround**. Example: `missing-dedicated-tool` (the gap) and `kludged-bash` (the workaround the agent reached for). Different remedy framings — `items[].suggestion` will read differently for each.
- The themes are **a general theme and a specific recurring sub-topic**. Example: `intent-conflict` is general; `status-update-policy` is the specific user-vs-developer policy clash that keeps coming up. Items can carry both; aggregating only the general theme would hide the topical recurrence.
- Different **framings** of the same underlying friction that agents reach for naturally. Example: `artifact-readback` (the access-side framing — "reading is hard") and `flat-prose-blob` (the shape-side framing — "the data is unstructured"). Both spellings recur on their own; merging would lose half the discovery signal.

**Leave alone** (singletons / count=1):
- Specific bugs in specific tools (`browsertools-fill-slider-noop`).
- Specific patch-name or phase-name keywords (`phase-44-spec-vs-decision`).
- Anything that reads as discovery — first-time naming of something that hasn't yet recurred. Free-form discovery is what V2's keyword design preserves; merging singletons closes that loop.

When in doubt, **under-merge**. A theme that emerges later can be folded then; a merge that erased two distinct signals is hard to undo without re-reading rows.

### 4. Pick canonical names

Two rules:

- **Reuse V1 canonicals** when the theme is identical to V1 (`context-bloat`, `cli-shell-escaping`, `todowrite-noise`, `decision-framework-gap`, `tool-output-noise`, `deferred-tool-noise`, `dirty-worktree`, `parallel-dispatch`, `skill-list-noise`). Cross-version theme continuity matters for trend reading.
- **Pick the most-mentioned spelling** as the canonical when the theme is new in V2. Agents reaching for that spelling most often have voted with their typing fingers — easier on future reflectors and easier on the human reading the inventory.

### 5. Edit the MAPPING and dry-run

The mapping lives at the top of `.agents/tools/workflow/introspection/keywords-normalize-v2.ts`. Add the new entries with one comment-block per cluster explaining the theme and any non-obvious "keep distinct" calls. Then:

```bash
npx tsx .agents/tools/workflow/introspection/keywords-normalize-v2.ts --dry-run
```

Reports `mapping entries` and `canonical targets`. Sanity check: the number of canonical targets should be roughly the number of clusters you intended.

### 6. Apply

```bash
npx tsx .agents/tools/workflow/introspection/keywords-normalize-v2.ts
```

Calls the `reflectionsV2.normalizeKeywords` mutation. Returns `{ scanned, updated }`. Idempotent — re-runs only patch rows where keywords actually change. The mutation rewrites top-level `keywords` AND every `items[].keywords` server-side, so one mapping entry fixes both layers.

### 7. Re-inventory and read

```bash
npx tsx .agents/tools/workflow/introspection/keywords-inventory-v2.ts --all
```

Top-of-list is now the answer to *"what's loudest across this fleet right now?"* Read it as themes, not variants. Cross-check:

- Does the top-10 match what the rubric is probing? If rubricV2 has a focus area and that theme isn't appearing in the top-of-list keywords, either the rubric is wrong about what's loud, or the keyword family for that theme hasn't consolidated yet (re-cluster).
- Anything new at the top that wasn't there last pass? That's an emerging theme — drill into items[] painPoints to understand it.
- Anything that *dropped* off the top? Could be a real win (fix landed and friction stopped) or aggregation drift (merged into another canonical) — check the mapping.

## What the loop produces (and doesn't)

**Produces:** a ranked list of friction themes by entry frequency. That's the severity signal, by design (mental-model.md §Reflection is critical-leaning by design).

**Doesn't produce:** an action list. Frequency = severity, but the *loudest* theme is not always the *actionable* one. Some loud themes are harness-internal (we can't remove them) — knowing they're tolerated loudly is still decision-grade, but the decision is "leave it." Acting requires reading the items[].suggestion field for the relevant cluster and judging which remedies are feasible.

**Doesn't produce:** a single-row diagnosis. When a specific dispatch went wrong, the postmortem-chain workflow is the right tool, not aggregate reading.

## Pitfalls

- **Over-merging.** Killing complement themes (cause/effect, symptom/shape) collapses two signals into one and hides behavioural patterns. When in doubt, leave distinct.
- **Singleton hunting.** The long tail of singletons is the discovery surface — it's where new themes show up before they have a name. Don't try to "tidy" it. Only merge when count >=2 and the variants are clearly the same complaint.
- **Stale canonicals.** When a rubric question changes, the keyword family agents reach for shifts too. Old canonicals can stop matching incoming spellings — re-cluster after rubric edits, not just after volume thresholds.
- **Forgetting items[].** The mutation rewrites both layers, but cluster judgment only reads top-level counts. Sanity check by sampling items[].keywords for a few representative rows to make sure the canonical you picked is consistent with how items use it.

## Reference

- CLIs: `.agents/tools/workflow/introspection/{dump-reflections-v2,keywords-inventory-v2,keywords-normalize-v2}.ts`
- V2 schema: `workflow-engine/convex/schema.ts` (`reflectionsV2` table)
- V2 mutation: `workflow-engine/convex/reflectionsV2.ts` (`normalizeKeywords`)
- Design principles: `docs/project/spec/mental-model.md` §Agent Reflection Feedback Loop, §Design Principles for Capture, §Structural Direction (Converging on V2)
- RubricV2 framing: `docs/project/spec/mental-model.md` §RubricV2 — Greenfield, Evidence-Based, Framing-Led
- Single-row postmortem: `docs/project/guides/cross-job-postmortem.md`
- Periodic curiosity-driven dive output: `docs/project/spec/reflection-analysis-2026-05.md` (Phase 16, the first instance of the periodic dive described in mental-model.md §Steward Analysis Workflow)
- Periodic curiosity-driven dive output: `docs/project/spec/reflection-analysis-2026-06.md` (second periodic dive, applying the causal-tracing guide; 14 ranked findings across 29 keywords)
