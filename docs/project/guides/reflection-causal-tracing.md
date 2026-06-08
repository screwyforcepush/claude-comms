# Reflection Causal Tracing — Aggregate Walk-up to Originating Layers

The procedural manual for the **periodic curiosity-driven dive** against the reflection dump. Aggregate analysis whose deliverable is a chain of causation from observed symptom → mechanism → originating in-repo authoring layer → specific lever.

The why-layer (purpose, principles, distinction from sibling flows) lives in [`mental-model.md` §Steward Analysis Workflow](../spec/mental-model.md). This guide is the *how*.

## When to run this

- Periodic — reflection data has accumulated enough to warrant a broad dive (~100+ new rows since the last one, or a quarter's worth of activity).
- Curiosity prompted — a recurring friction or rubric pattern warrants tracing to its origin.

Not this guide:
- Routine keyword canonicalisation → [`reflection-analysis-workflow.md`](./reflection-analysis-workflow.md)
- Single-chain interrogation, resurrect agents → [`cross-job-postmortem.md`](./cross-job-postmortem.md)

## Procedure

### 0. Get a fresh dump

```bash
npx tsx .agents/tools/workflow/introspection/dump-reflections-v2.ts \
  --output /tmp/reflections-v2-dump.json
```

### 1. Surface candidates

Inventory item-level keyword frequencies in the dump. High-volume keywords that haven't been walked up in prior dives are candidates. Exclude keywords whose originators are already known and remediated.

```bash
node -e "
const d=JSON.parse(require('fs').readFileSync('/tmp/reflections-v2-dump.json','utf8'));
const counts={};
for (const r of d) for (const it of (r.items||[])) for (const kw of (it.keywords||[])) counts[kw]=(counts[kw]||0)+1;
console.log(Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([k,c])=>c.toString().padStart(4)+' '+k).join('\n'));
"
```

Sample 3–5 painPoints per candidate to confirm the keyword is talking about a real, namable friction (not a normalization artifact).

### 2. Slice-pattern cross-tab

For each candidate, group hits by **harness**, **jobtype**, and **namespace** *independently*. The shape points at the authoring scope to walk to:

| Slice pattern | Walk-up target |
|---|---|
| one **harness** only | harness rules or harness-branched template sections |
| one **jobtype** only | that jobtype's prompt template |
| one **namespace** only | namespace config or project-specific files |
| **intersection** (e.g. one harness × one jobtype) | where a higher-scope rule meets a narrower task; in-repo lever usually lives in the narrower layer, often *threading* the higher-scope rule rather than overriding it |
| **global** (across all slices) | AOP, CLAUDE.md, prompts.ts, or shared tooling |

```bash
node -e "
const d=JSON.parse(require('fs').readFileSync('/tmp/reflections-v2-dump.json','utf8'));
const KW='<keyword>';
const byH={}, byJ={}, byN={};
for (const r of d) for (const it of (r.items||[])) if ((it.keywords||[]).includes(KW)) {
  byH[r.harness]=(byH[r.harness]||0)+1;
  byJ[r.jobType]=(byJ[r.jobType]||0)+1;
  byN[r.namespace]=(byN[r.namespace]||0)+1; break;
}
console.log({byH,byJ,byN});
"
```

Slice patterns are signals pointing at *where the originator lives*, not constraints on what findings can be promoted.

### 3. Sub-cluster keywords with N > 5 hits

Keywords are discovery surfaces, not analytical units. A high-volume keyword often aggregates multiple distinct mechanisms with different originators. Read 5–10 painPoint samples and bucket by mechanism before walking up.

**One walk-up per mechanism, not one walk-up per keyword.**

### 4. Walk up to the originating layer

Per mechanism:

1. Quote a representative painPoint verbatim.
2. Identify which in-repo artifact the agents were operating under (template, AOP section, CLI, prompt module) using the slice fingerprint and the painPoint's citations.
3. **Read that artifact in full.** Do not paraphrase, read.
4. Quote the relevant section. Verify the painPoint citations match (verbatim or near-paraphrase). Confabulated citations happen — always verify.
5. Decide: is the friction **authored** here, or **inherited** from upstream?
   - Authored → this is the originating layer.
   - Inherited → walk to the upstream artifact and repeat.

Stop only when the artifact you're at *instructs, permits, or fails-to-prevent* the friction-causing pattern — and editing it would change what gets authored downstream.

### 5. Identify the lever

The lever is the edit at the originating layer that would stop the friction being authored upstream. Common shapes:

- **Threading vs. overriding.** When only some layers are editable, design the lever to *interface with* upstream constraints rather than negate them. (Example: an in-repo template that explicitly instructs the bash form for a task satisfies the harness's own "unless explicitly instructed" carve-out.)
- **Branch-missing vs. branch-flawed.** A decision-framework gap may need a *catch-all clause* (when the situation doesn't fit any enumerated branch) OR a *surgical fix to an existing branch's prescription* (when the branch fires but its instruction is broken). Structurally different fixes — apply both if both shapes are present.
- **One originator, many sites.** A keyword can be authored across multiple files in the same directory (e.g., `pm-modules/post-review.md` AND `pm-modules/post-plan.md`). The lever is then the pattern of edit applied across all sites.

### 6. Completion test

> *If I edit the lever, does the friction stop being authored?*

- If the edit just suppresses the symptom downstream while the originating artifact still produces the broken pattern → keep walking up.
- If the lever closes some sub-mechanisms but not all → split into multiple levers, each tested independently. Flag the residual sub-mechanisms honestly.

## Failure modes

- **Stopping at the keyword.** A keyword name is a label, not a mechanism. *"context-bloat"* is not a finding; *"PM compiles artifacts monotonically because pm.md instructs compile-not-curate"* is.
- **Stopping at the file.** Naming *"this file has the symptom"* is not the same as naming the originator. Verify the file *authors* the pattern (instructs/permits/fails-to-prevent) by reading and quoting.
- **Treating slice concentration as a confound.** A signal concentrated in one harness/jobtype/namespace is a *navigation signal*, not evidence of population skew that suppresses the finding.
- **Treating priors as analysis.** *"Covered by priors"* is not a stopping condition. Mechanisms within priors themes still walk up.
- **Confabulated citations.** PainPoints sometimes paraphrase or misquote what the artifact says. Always read the artifact and verify the quote before treating the painPoint as evidence.
- **Skipping sub-mechanism decomposition.** A keyword with N > 5 hits is likely a union of mechanisms. One walk-up per mechanism.

## Output

A diagnosis document with one entry per promoted finding. Each entry contains:

- **Symptom** — count, slice pattern by harness/jobtype/namespace, 2–3 representative painPoint quotes (verbatim, with jobId).
- **Mechanism** — the specific named pattern. Sub-mechanisms enumerated if the keyword decomposed.
- **Originating Layer** — the in-repo artifact, verified by direct quote of the relevant section (file path + line range).
- **Lever** — the edit at the originating layer (file path + section + 1-line description), per sub-mechanism if decomposition is needed.
- **Completion Test Outcome** — does the lever close each sub-mechanism? Flag partials honestly.

Plus a **Known unanswered** section for leads that were surfaced but not walked up within the iteration cap. *Leads are not findings* — do not propose remedies for them. Either a candidate has a completed walk-up (→ promoted finding with lever), or it doesn't (→ known unanswered).
