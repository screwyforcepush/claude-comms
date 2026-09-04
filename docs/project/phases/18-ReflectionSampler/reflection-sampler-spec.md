# Reflection Sampling Quota per Engine Version + Install-Time Version Stamping

Phase: `18-ReflectionSampler`
Status: **DELIVERED (code landed, static-validated) — NOT YET DEPLOYED.** All 5 WPs implemented and code-reviewed; validation gates (`build`, `lint`, `ts:check`, `test`) pass. Convex is **not** deployed and nothing was restarted (self-surgery). See § "Delivery Status & Deploy Requirement" below and § 9 for the landed shape. The landed implementation matches this spec with no material deviations.
Why-layer: `docs/project/spec/mental-model.md` § "Sampling Budget & Engine Versioning" (read-only; cite, never author)

> ## ⚠️ Delivery Status & Deploy Requirement (read before doing anything with this phase)
> **A Convex deploy is REQUIRED to activate this phase** (schema + `shouldReflect` + `setReflectionsEnabled` + `countForEngineVersion`). It was intentionally NOT performed — this was self-surgery on the running engine.
>
> Until the user deploys Convex, two things are true (both by design, see § 3.5 / D2 / D3):
> 1. **The sampler is inert and fails OPEN.** `reflect-spawn.ts` already calls `shouldReflect` on the next terminal job (edits go live per-invocation via `npx tsx`), but the mutation doesn't exist on prod yet, so the call throws and the client proceeds to spawn reflections exactly as before. No reflection is lost from the sampler side pre-deploy.
> 2. **`reflect.ts` inserts now carry an `engineVersion` arg the still-old prod `insert` rejects.** Reflections written from THIS repo's namespace between merge and deploy therefore **fail to insert**, and surface *visibly* in the coverage alarm as `reflection_missing` (honest, bounded failure — not silent loss).
>
> **Action for the user:** deploy Convex promptly after accepting this assignment. Deploy with the project-standard command (`CONVEX_DEPLOYMENT=prod:<convex-deployment> npx convex deploy`) and verify with `--prod`. Then optionally run `reflections status` per namespace to confirm the sampler is armed. The index `by_namespace_engineVersion` backfills automatically on deploy; no migration or backfill script is needed.

> **SELF-SURGERY CONSTRAINTS (apply to every job in this assignment)**
> This assignment modifies the engine that is running the assignment crew.
> - NO deploy (no Convex deploy, no npm publish).
> - NO engine/runner/UI-server stop/start/restart.
> - NO manual reflection triggering.
> - NO tests that exercise the live engine/runner. Validation is **static only: typecheck/build**.
> - NO UAT jobs. Chain: plan → implement → review (→ document). User deploys/tests outside this assignment.

---

## 1. Purpose

Reflection capture currently fires on every terminal job forever (5,500+ rows). Frequency-is-severity needs volume, but the ranking stabilises at ~100 reflections per namespace per engine version — beyond that each reflection is pure tax (tokens, latency) with zero marginal signal. Separately, `engineGitSha` capture is defective: in consumer repos the installed `.agents` copy has no git identity, so `rev-parse` walks up and records the *consumer's* HEAD (verified: `clientGitSha == engineGitSha` in 100% of 2,226 sampled rows), making per-engine-version analysis impossible.

This phase delivers:
1. A **self-arming, self-disarming sampler**: reflections flick on when a new engine version appears in a namespace, flick off when the (namespace, version) count enters the 100–110 band. No human has to remember a toggle.
2. **True engine identity on every reflection row**: the installer stamps what it fetched into `.agents/engine-manifest.json` at install time; `reflect.ts` reads it. Release version (e.g. `2.0.19`) is the analysis key; SHA stays for fine-grained tracing.
3. **Manual control surfaces**: CLI verb + Harness Config modal toggle, plus a namespace picker on the modal header (long-standing annoyance).
4. **Honest coverage alarm**: sampler-skipped jobs report `reflection_disabled`, never `reflection_missing`.

Vocabulary rule: the string **"quota" appears nowhere** in schema fields, values, or user-facing copy. The skip value is `"disabled"`.

All product decisions (sampler pseudocode, band semantics, field names, release-version-as-key, UI placement) are **already made** in the north star. This spec is work-package breakdown and sequencing only — implementers do not re-litigate them.

## 2. Overview

| Piece | Where | What |
|---|---|---|
| Sampler decision point | `workflow-engine/convex/reflectionsV2.ts` new mutation `shouldReflect` | Server-side, transactional; all runners share one decision |
| Sampler caller | `.agents/tools/workflow/reflect-spawn.ts` | Calls `shouldReflect` EARLY (before session resurrection, the expensive part); exits cleanly on false |
| Engine identity | `.agents/engine-manifest.json` (installed clients) / installer-package fallback (source repo) | New shared resolver lib consumed by `reflect.ts`, `reflect-spawn.ts`, `cli.ts` |
| Manifest writer | `packages/setup-installer` | Stamps `{engineVersion, engineGitSha, installedFrom, installedAt}` into the installed `.agents` |
| Coverage honesty | `reflectionsV2.gaps` | `reflectionSkipped` jobs → `skipReason: "reflection_disabled"` |
| Manual control | `cli.ts` `reflections status\|on\|off`; `NamespaceSettings.js` toggle + namespace picker | Honored per sampler logic (band overrides manual) |

## 3. Architecture Design

### 3.1 Sampler logic (user-authored — implement EXACTLY this, server-side)

```
// all namespaced; count = reflectionsV2 rows for (namespace, currentEngineVersion), via index
if count == 0: set namespace.reflectionsEnabled = true      // auto-arm for a new engine version
if count > 100 && count < 110: set reflectionsEnabled = false  // auto-disarm in the band
enabled = namespace.reflectionsEnabled (absent/undefined = true)
if enabled: spawn reflection; else: stamp job reflectionSkipped = "disabled" and skip
```

Binding notes for the implementer:
- The band condition is the **pseudocode**, not the prose: `count > 100 && count < 110` disarms at counts 101–109 inclusive. Do not "correct" it to `100–110`.
- Count via the new index with **`.take(111)`** — bounded read; only 0 / below-band / in-band matters, so `length` of that page is sufficient.
- `enabled` is read **after** the auto-arm/auto-disarm flips (i.e., the flipped value governs this same call). Compute in memory, patch, then branch.
- The flag flips, the job stamp, and the decision happen in **one Convex mutation = one transaction**.
- **Accepted rough edges — do not "fix"**: a brand-new version cannot be pre-disabled (count==0 forces on until first row lands); manual re-enable past the band stays on indefinitely; manual toggle is overridden while inside the band; concurrent in-flight jobs can overshoot the band (that is what the ~10-row band buffer is for); a count that jumps *past* the band without landing in it stays armed.

### 3.2 Engine identity resolution ladder (shared lib)

New module `.agents/tools/workflow/lib/engine-version.ts`:

```
getEngineIdentity(): { engineVersion?: string; engineGitSha?: string; source: "manifest" | "source-repo" | "unknown" }
```

1. **Manifest** (installed consumer repos): read `<.agents>/engine-manifest.json` (path relative to the lib: `join(__dirname, "..", "..", "..", "engine-manifest.json")`). Valid ⇒ `{engineVersion, engineGitSha, source: "manifest"}`.
2. **Source-repo fallback** (this repo — no manifest): `engineVersion` = `packages/setup-installer/package.json` `.version` (currently `2.0.19`; releases bump in sync with pushes); `engineGitSha` = current `git rev-parse HEAD` of the workflow dir (existing behavior).
3. **Graceful degradation**: absent file, unreadable file, corrupt JSON, or missing/non-string `engineVersion` ⇒ fall through to (2); if (2) also fails ⇒ both fields `undefined`, `source: "unknown"`. **Never throw.** An `undefined` engineVersion is a legitimate degenerate bucket for the sampler — do not special-case it.

`clientGitSha` capture (`gitSha(process.cwd())` in `reflect.ts`) is **unchanged**.

### 3.3 Data flow — terminal job to reflection (after this phase)

```
runner.ts job terminal → spawnReflection(jobId)            [UNCHANGED — single choke point, 8 call sites untouched]
  └─ reflect-spawn.ts
       eligibility checks (terminal, harness, sessionId, namespaceId)   [existing]
       engineIdentity = getEngineIdentity()                              [new, cheap fs reads]
       shouldReflect({jobId, engineVersion}) → Convex                    [new — BEFORE template read / harness spawn]
         ├─ false → job already stamped reflectionSkipped:"disabled" server-side; exit 0
         ├─ true  → continue to session resurrection (expensive part) as today
         └─ THROWS (e.g. mutation not yet deployed) → FAIL-OPEN: proceed as if true   [required, see 3.5]
  └─ agent runs reflect.ts
       engineIdentity = getEngineIdentity()
       insert({... engineVersion, engineGitSha: from identity, clientGitSha: unchanged})
```

### 3.4 Installer manifest flow

```
npx claude-comms [--version <ref>]        (ref defaults to 'main')
  fetch .agents tree (tarball → contents fallback)          [existing]
  resolveCommitSha(ref) via GET /repos/{owner}/{repo}/commits/{ref}   [new, uses existing _makeRequest retry infra]
  inject synthetic file into the write set:
    .agents/engine-manifest.json = {
      "engineVersion": <installer's own package.json version>,
      "engineGitSha":  <resolved full SHA, or null on resolution failure>,
      "installedFrom": "<owner>/<repo>#<ref>",
      "installedAt":   <ISO-8601 timestamp>
    }
  write with the normal writeDirectory transaction (participates in dry-run & rollback)
```

- The manifest must **NOT** be added to `preserveIfExists` — every install/update overwrites it (that is the point: it tracks what is currently installed).
- SHA resolution failure degrades to `engineGitSha: null` + a logged warning; the manifest still ships with `engineVersion` (the analysis key). Never fail the install over it.
- The manifest is never committed to this repo, so tarball fetches of `.agents` never contain a stale one.
- Note: `engineVersion` is the **installer package's own version** (per north star AC5). If a user explicitly installs a divergent ref (`npx claude-comms@2.0.19 --version some-branch`), `installedFrom` + `engineGitSha` record the divergence — that is the manifest's job, not a bug.

### 3.5 Deploy-window skew (self-surgery reality — MUST be handled/documented)

The runner spawns `reflect-spawn.ts`/`reflect.ts`/`cli.ts` **fresh via `npx tsx` per invocation** — file edits go live on the next terminal job, *before* the user deploys Convex. Two skew cases:

1. **`shouldReflect` not yet deployed** → the client call throws. Requirement: **fail-open** (catch around the `shouldReflect` call only; on error proceed to spawn as today). This preserves AC10 (existing behavior unchanged pre-deploy) and prevents this assignment's own crew jobs from silently losing reflections mid-flight.
2. **`insert` without the `engineVersion` arg on prod** → Convex rejects the unknown argument; reflections written between merge and deploy **fail**. This is accepted: the window is bounded (user deploys immediately after accepting), and the loss is *visible* in the coverage alarm as `reflection_missing` — honest failure over silent complexity at the write choke point. **PM must surface this in the completion summary**: "deploy Convex promptly after accepting; reflections in this repo's namespace fail insert until then."

The CLI verb and UI toggle call a new mutation (`setReflectionsEnabled`) that also errors clearly pre-deploy — acceptable, they are new features.

### 3.6 Schema changes (all additive — no backfill, no migration)

| Table | Field / Index | Shape |
|---|---|---|
| `namespaces` | `reflectionsEnabled` | `v.optional(v.boolean())` — **absent = enabled** |
| `reflectionsV2` | `engineVersion` | `v.optional(v.string())` |
| `reflectionsV2` | index `by_namespace_engineVersion` | `["namespaceId", "engineVersion"]` |
| `jobs` | `reflectionSkipped` | `v.optional(v.literal("disabled"))` |

Legacy rows/jobs simply lack the fields. The index backfills automatically on deploy; legacy rows have `engineVersion` undefined and land in the undefined bucket, which no current-version count ever matches — a new version's count starts at 0 ⇒ auto-arm works from day one.

## 4. Dependency Map

```
WP1 Convex backend (schema, shouldReflect, gaps, setReflectionsEnabled, countForEngineVersion)
 ├──> WP2 Engine client (engine-version lib, reflect.ts, reflect-spawn.ts)   [needs WP1 function names/args]
 ├──> WP4 CLI reflections verb                                               [needs WP1 mutations + WP2 lib]
 └──> WP5 UI toggle + namespace picker                                       [needs WP1 mutations]
WP3 Installer manifest — INDEPENDENT of WP1/2/4/5 (only contract: manifest JSON shape, fixed in this spec)
```

- **Parallelizable**: WP3 with everything. WP2/WP4/WP5 with each other once WP1's function signatures exist.
- **Practical recommendation**: one implement job delivers WP1→WP5 in order (small, interlocked via shared names; splitting risks contract drift across parallel workers). WP4 depends on WP2's lib, so within-job order is WP1, WP2, WP3, WP4, WP5.
- The manifest JSON shape (§3.4) and `shouldReflect` contract (§3.1, §5-WP1) are the only cross-WP contracts; they are fully pinned here.

## 5. Work Package Breakdown

> No UAT vertical slices in this assignment (self-surgery: strictly no UAT). Each WP instead carries static-verifiable success criteria; live verification is the user's post-deploy step.

### WP1 — Convex backend: schema + sampler mutation + coverage honesty

Files: `workflow-engine/convex/schema.ts`, `workflow-engine/convex/reflectionsV2.ts`, `workflow-engine/convex/namespaces.ts`

1. **Schema** per §3.6.
2. **`shouldReflect` mutation** (`reflectionsV2.ts`) — args `{password, jobId: v.id("jobs"), engineVersion: v.optional(v.string())}`:
   - Load job; require terminal status and `namespaceId` (throw otherwise — reflect-spawn already gates these; the throw is caught fail-open client-side).
   - `count` = `.withIndex("by_namespace_engineVersion", q => q.eq("namespaceId", ns).eq("engineVersion", args.engineVersion)).take(111)` → `.length`.
   - Apply §3.1 pseudocode exactly; patch `namespaces.reflectionsEnabled` on flips; on false, patch `jobs.reflectionSkipped: "disabled"`; all in this one mutation.
   - Return `{ shouldReflect: boolean, count: number, reflectionsEnabled: boolean }` (debuggability; caller only branches on `shouldReflect`).
3. **`insert` mutation**: accept optional `engineVersion` arg; write it to the row. No other insert changes.
4. **`gaps` query**: add branch — after the `missing_session_id` check, `else if (job.reflectionSkipped) skipReason = "reflection_disabled"`, before the `reflection_missing` fallthrough.
5. **`countForEngineVersion` query** (small, for CLI status): args `{password, namespaceId, engineVersion: v.optional(v.string())}` → `{count}` via the same index + `.take(111)`.
6. **`namespaces.setReflectionsEnabled` mutation**: args `{password, namespaceId, enabled: v.boolean()}` → patch `reflectionsEnabled` + `updatedAt`.

Success criteria:
- [ ] Schema fields/index exactly as §3.6; all three fields optional; no other schema drift.
- [ ] `shouldReflect` implements §3.1 pseudocode verbatim (band `>100 && <110`, `.take(111)`, absent-flag = true, flip-then-read, single transaction, job stamped on false).
- [ ] `gaps` never reports `reflection_missing` for a `reflectionSkipped` job.
- [ ] `"quota"` appears nowhere in any added identifier, value, or string.
- [ ] `npx tsx .agents/tools/validate/cli.ts` typecheck/build gates pass. No deploy.

### WP2 — Engine client: identity lib + reflect.ts + reflect-spawn.ts

Files: `.agents/tools/workflow/lib/engine-version.ts` (new), `.agents/tools/workflow/reflect.ts`, `.agents/tools/workflow/reflect-spawn.ts`

1. **`lib/engine-version.ts`** per §3.2 — sync fs, never throws, three-source ladder.
2. **`reflect.ts`**: replace `engineGitSha: gitSha(__dirname)` with identity-lib values; add `engineVersion` to the insert payload; `clientGitSha` untouched; bump `REFLECTION_CLI_VERSION` (`0.2.0` → `0.3.0`).
3. **`reflect-spawn.ts`**: after the existing eligibility checks (post `namespaceId` guard, ~line 160) and **before** template read / harness spawn: resolve identity, call `api.reflectionsV2.shouldReflect`; `shouldReflect === false` → return silently (job already stamped server-side). **Wrap only this call in its own try/catch — fail-open on any error** (§3.5, with a `debug()` note). The `spawnReflection()` choke point in `runner.ts` and its 8 call sites are **untouched**; no per-call-site logic.

Success criteria:
- [ ] `runner.ts` diff is empty.
- [ ] `shouldReflect` is called before any template/file/harness work beyond the existing job query; false ⇒ clean exit 0, no harness process spawned.
- [ ] A thrown/rejected `shouldReflect` (simulated by code reading, not live test) falls through to today's spawn path.
- [ ] Manifest absent/corrupt ⇒ source-repo fallback values; identity lib provably cannot throw (all fs/JSON wrapped).
- [ ] In the source repo, `engineVersion` resolves to the installer package version and `engineGitSha` to a real HEAD sha (static reasoning / typecheck only — no live reflection triggered).
- [ ] Validate CLI typecheck/build pass.

### WP3 — Installer: engine-manifest.json stamping

Files: `packages/setup-installer/src/fetcher/github.js`, `packages/setup-installer/src/orchestrator/installer.js`, (`src/utils/constants.js` for the manifest filename constant if useful)

1. **`GitHubFetcher.resolveCommitSha(ref)`**: `GET /repos/{owner}/{repo}/commits/{ref}` through the existing `_makeRequest` retry/rate-limit infra; return full SHA string, or `null` on any failure (warn, don't throw past the orchestrator).
2. **Orchestrator**: in `_installFilesWithTransaction` (after `_flattenFiles`, alongside the `preserveIfExists` filtering), append the synthetic `.agents/engine-manifest.json` entry per §3.4 to `filesToWrite`. `engineVersion` from `require('../../package.json').version`; ref is `this.options.version`. Dry-run lists it; rollback removes it; **not** in `preserveIfExists`.

Success criteria:
- [ ] Manifest shape exactly `{engineVersion, engineGitSha, installedFrom, installedAt}` (§3.4 formats).
- [ ] SHA resolution failure still writes the manifest (`engineGitSha: null`) and does not fail the install.
- [ ] Manifest overwritten on re-install (not preserved).
- [ ] No install is executed as verification — static review + typecheck/build/lint gates only.

### WP4 — CLI: `reflections` verb

Files: `.agents/tools/workflow/cli.ts`

1. New command `reflections [status|on|off]` (default `status`), registered in `COMMAND_FLAGS` (no flags) and both usage texts.
   - `status`: namespace doc via `api.namespaces.get` + `getEngineIdentity()` + `api.reflectionsV2.countForEngineVersion` → output `{ namespace, reflectionsEnabled (absent→true), engineVersion, engineVersionSource, countForVersion }` (display `111` as `"111+"`). Count is best-effort: if the query fails (pre-deploy), still print the flag with a note.
   - `on` / `off`: `api.namespaces.setReflectionsEnabled` with `enabled: true/false`; output confirms and reminds that the sampler band overrides manual state while inside it.
2. Namespace = the CLI's configured namespace (`getNamespaceId()` pattern), matching every other verb.

Success criteria:
- [ ] `reflections status|on|off` present in `COMMAND_FLAGS`, `USAGE`, and the header comment block; unknown-flag validation intact.
- [ ] `on`/`off` write only `reflectionsEnabled`; no other namespace fields touched.
- [ ] No "quota" in any output copy.
- [ ] Validate CLI typecheck/build pass. Command not executed against prod as part of this assignment.

### WP5 — UI: reflections toggle + namespace picker in Harness Config modal

Files: `workflow-engine/ui/js/components/namespace/NamespaceSettings.js`, `workflow-engine/ui/js/hooks/useNamespaceSettings.js`, `workflow-engine/ui/js/components/chat/ChatPanel.js` (prop plumbing only), `workflow-engine/ui/js/api.js` if new function refs need registering

1. **Hook** (`useNamespaceSettings.js`): additionally query the namespace doc (`api.namespaces.get`) → expose `reflectionsEnabled` (absent ⇒ `true`); expose `setReflectionsEnabled(enabled)` calling the new mutation. Existing harnessDefaults read/save unchanged.
2. **Toggle** (`NamespaceSettings.js`): a "Reflections" row at the top of the modal body, above the job-type rows. On/off switch, **immediate write** on click (this is a live operational flag, unlike the staged harnessDefaults JSON — do not couple it to the Save button). Styling: Q palette, `React.createElement` only, zero rounded corners; armed state uses a Fullbright accent (slime pulse dot pattern), off state dim bone/stone. Brief sub-caption: "self-arming per engine version" (no "quota").
3. **Namespace picker**: the header namespace label (currently a passive `span` next to "Harness Config") becomes clickable → angular dropdown listing all namespaces by name → selecting one switches which namespace the modal is configuring. Plumbing: `ChatPanel` passes `namespaces` (the `{_id, name}` array it already holds) and `onSwitchNamespace: setSettingsNamespaceId`; existing props (`namespaceId`, `namespaceName`, `allNamespaceIds`) stay so the open-flow (`handleOpenSettings`) is untouched. On switch: reset `localConfig`/`dirty` and resync from the newly-selected namespace (unsaved harness edits are discarded — see Decisions).

Success criteria:
- [ ] Modal open-flow from `handleOpenSettings` behaves exactly as before when the picker is never used (existing props honored).
- [ ] Toggle reflects absent-field-as-enabled; clicking writes immediately and re-renders from the subscription.
- [ ] Picker switches `namespaceId` for both the harnessDefaults editor and the toggle; dirty state resets on switch.
- [ ] No JSX anywhere; zero rounded corners; Q palette tokens only; no "quota" in copy.
- [ ] Validate CLI build gate (`node --check` syntax guard for UI JS) passes. No browser UAT.

## 6. Assignment-Level Success Criteria

Mirrors the north star's 10 acceptance criteria; the review job verifies each:

1. Schema: `namespaces.reflectionsEnabled` optional bool (absent = enabled); `reflectionsV2.engineVersion` optional string + `by_namespace_engineVersion` index; `jobs.reflectionSkipped` optional literal `"disabled"`.
2. `shouldReflect` in `reflectionsV2.ts`: §3.1 pseudocode, transactional, `.take(111)`, stamps the job on false, server-side single decision point.
3. `reflect-spawn.ts` calls `shouldReflect` before session resurrection and exits cleanly on false; `runner.ts` `spawnReflection` choke point unchanged (8 call sites untouched).
4. `reflect.ts` stamps `engineVersion` + `engineGitSha` from the manifest when present; source-repo fallback = installer package version + existing rev-parse; `clientGitSha` unchanged.
5. Installer writes `.agents/engine-manifest.json` `{engineVersion, engineGitSha, installedFrom, installedAt}`.
6. `gaps`: `reflectionSkipped` jobs report `"reflection_disabled"`.
7. CLI `reflections status|on|off`.
8. UI toggle + namespace picker per WP5, matching existing modal patterns and UI conventions.
9. `grep -ri quota` over the diff surfaces nothing in schema fields, values, or user-facing copy.
10. Behavior unchanged when flag unset + manifest absent, except the sampler decision itself — enforced by absent-=-true semantics, fail-open on `shouldReflect` errors, and the source-repo fallback ladder.

**Validation protocol (every job)**: `npx tsx .agents/tools/validate/cli.ts`; read stdout JSON `ok`. Per self-surgery constraints, the binding gates are **typecheck and build**. Do not run anything that spawns harnesses, triggers reflections, hits the live runner, or deploys.

## 7. Ambiguities / Decisions

Decisions made in this spec (PM: ratify into the Decision Record; none warrant blocking):

| # | Decision | Rationale |
|---|---|---|
| D1 | Band arithmetic follows the **pseudocode** (`>100 && <110` ⇒ 101–109), not the "100–110" prose | North star says "implement EXACTLY this" about the pseudocode |
| D2 | `shouldReflect` client call **fails open** | AC10 + self-surgery: mutation doesn't exist on prod until the user deploys; fail-closed would silently kill all reflections mid-assignment (§3.5) |
| D3 | `insert` deploy-window skew **accepted, not engineered around**: reflections in this repo's namespace fail insert between merge and Convex deploy, visible as `reflection_missing` | Bounded window; honest, visible failure beats retry complexity at the write choke point. PM completion summary must tell the user to deploy promptly |
| D4 | UI toggle writes **immediately**, decoupled from the staged Save button | It's a live operational switch mirroring the CLI flick, not part of the harnessDefaults config document |
| D5 | Namespace switch while dirty **discards unsaved harness edits** (reset + resync) | Simplest non-breaking behavior; staged-edit-preservation across namespaces is out of scope |
| D6 | `installedFrom` format: `"<owner>/<repo>#<ref>"`; `installedAt` ISO-8601; SHA failure ⇒ `engineGitSha: null`, install proceeds | Manifest presence (the version key) matters more than the SHA garnish |
| D7 | Undefined `engineVersion` (identity ladder fully failed) is passed through as the undefined bucket, no special-casing | Degenerate-only path (manifest ships with the same install that ships the new reflect-spawn); accepted rough edge |
| D8 | Shared identity resolver lives in `.agents/tools/workflow/lib/engine-version.ts`, consumed by `reflect.ts`, `reflect-spawn.ts`, `cli.ts` | One ladder, three consumers; prevents drift |
| D9 | `shouldReflect` returns `{shouldReflect, count, reflectionsEnabled}`; separate lightweight `countForEngineVersion` query for CLI status | Decision debuggability without overloading the mutation for reads |

Open questions for the PM/user: **none blocking**. All product decisions were pre-made in the north star; the table above covers the residual implementation-level choices.

## 8. Recommended Job Sequence

1. **implement** (single job, this spec as brief): WP1 → WP2 → WP3 → WP4 → WP5 in order. One job over parallel implementers because the WPs share pinned contracts (§3.1, §3.4) and the total surface is modest; parallel workers would burn coordination on contract drift. Static validation per §6.
2. **review** (fan-out per namespace config): verify the 10 assignment-level criteria, with emphasis on: pseudocode fidelity incl. band arithmetic (D1); transactionality of `shouldReflect`; fail-open placement (D2); `runner.ts` untouched; manifest not in `preserveIfExists`; "quota" absence; no deploy/restart/test-execution violations in the implement job's transcript.
3. **document** (optional, PM's call): fold the landed shape into this phase dir if implementation deviated; `mental-model.md` is read-only and already carries the why-layer.
4. **PM completes** with a summary that must include the §3.5/D3 deploy note: *"Convex deploy required to activate (schema + shouldReflect + setReflectionsEnabled); until deployed, sampler is inert (fail-open) and reflection inserts from this repo fail visibly in coverage. Deploy, then optionally `reflections status` per namespace."* No UAT; the user evaluates and deploys outside this assignment.

## 9. Landed Implementation (Completion Review)

Recorded after implement + review landed. **All 5 WPs delivered; the landed code matches §§1–8 with no material deviations.** Static validation (`build`, `lint`, `ts:check`, `test`, `git diff --check`) passed; `quota` scan over the implementation files is clean; `runner.ts` diff is empty (choke point + 8 call sites untouched, per AC3). No deploy / publish / restart / UAT / manual-reflection trigger was run.

> Out of scope for this phase: the `normalizeKeywords` cursor-batching change in the same working tree is a **separate** keyword-normalisation effort and is intentionally not documented here.

### 9.1 WP1 — Convex backend (`schema.ts`, `reflectionsV2.ts`, `namespaces.ts`)

Schema (additive, exactly §3.6):
- `namespaces.reflectionsEnabled: v.optional(v.boolean())` — absent = enabled.
- `jobs.reflectionSkipped: v.optional(v.literal("disabled"))`.
- `reflectionsV2.engineVersion: v.optional(v.string())` + index `by_namespace_engineVersion` on `["namespaceId", "engineVersion"]`.

Functions:
- **`shouldReflect`** mutation — args `{ password, jobId: v.id("jobs"), engineVersion: v.optional(v.string()) }`. Loads the job (throws `"Job not found"` / `"Job must be terminal"` / `"Job is not reflection-integrated"` when the gates fail — these throws are caught fail-open client-side), loads the namespace, counts via the shared helper, applies the §3.1 pseudocode **verbatim** (`if count === 0` → arm; `if count > 100 && count < 110` → disarm — the literal band per **D1**, disarms at 101–109), patches `namespaces.reflectionsEnabled` on flips, and on a `false` decision patches `jobs.reflectionSkipped: "disabled"` — all in the one mutation/transaction. Returns `{ shouldReflect, count, reflectionsEnabled }` (**D9**; caller branches only on `shouldReflect`).
- Shared private helper **`countReflectionsForEngineVersion(ctx, namespaceId, engineVersion?)`** — the single `by_namespace_engineVersion` + `.take(111)` → `.length` read; used by both `shouldReflect` and `countForEngineVersion` so the bounded-read contract lives in one place.
- **`countForEngineVersion`** query — args `{ password, namespaceId, engineVersion: v.optional(v.string()) }` → `{ count }`. Lightweight read for CLI/UI status.
- **`insert`** mutation — gains optional `engineVersion` arg, written straight to the row; no other insert change.
- **`gaps`** query — new branch after `missing_session_id`: `else if (job.reflectionSkipped) skipReason = "reflection_disabled"`, before the `reflection_missing` fallthrough (AC6).
- **`namespaces.setReflectionsEnabled`** mutation — args `{ password, namespaceId, enabled: v.boolean() }`; patches `reflectionsEnabled` + `updatedAt` only.

### 9.2 WP2 — Engine client (`lib/engine-version.ts` new, `reflect.ts`, `reflect-spawn.ts`)

- **`lib/engine-version.ts`** — `getEngineIdentity(): { engineVersion?, engineGitSha?, source: "manifest" | "source-repo" | "unknown" }`. The §3.2 ladder: (1) read `<.agents>/engine-manifest.json` (path `join(__dirname, "..","..","..","engine-manifest.json")`) → `source: "manifest"` when `engineVersion` is a string; (2) source-repo fallback → `engineVersion` from `packages/setup-installer/package.json` `.version`, `engineGitSha` from `git rev-parse HEAD` of the workflow dir (`source: "source-repo"`); (3) `{ source: "unknown" }` with both fields undefined. All fs/JSON/`spawnSync` reads are try/wrapped — **provably cannot throw** (AC/§3.2 graceful degradation). `undefined engineVersion` is passed through as the degenerate bucket, not special-cased (**D7**).
- **`reflect.ts`** — `REFLECTION_CLI_VERSION` bumped `0.2.0` → `0.3.0`; the insert payload now sends `engineVersion: engineIdentity.engineVersion` and `engineGitSha: engineIdentity.engineGitSha` (replacing the old `gitSha(__dirname)`). `clientGitSha: gitSha(process.cwd())` is **unchanged** (AC4).
- **`reflect-spawn.ts`** — after the existing eligibility guards (terminal / harness / `sessionId` / `namespaceId`) and **before** session resurrection / template read / harness spawn: resolves identity, calls `api.reflectionsV2.shouldReflect`; `decision.shouldReflect === false` → `debug(...)` + `return` (job already stamped server-side). The call is wrapped in its own try/catch that **fails open** with a `debug()` note (**D2** / §3.5-case-1). No `runner.ts` change.

### 9.3 WP3 — Installer manifest (`fetcher/github.js`, `orchestrator/installer.js`)

- **`GitHubFetcher.resolveCommitSha(ref)`** — `GET /repos/{owner}/{repo}/commits/{ref}` (URL-encoded ref) through the existing `_makeRequest` retry/rate-limit infra; returns the full SHA string, or `null` + a `console.warn` on any failure (never throws past the orchestrator).
- **Orchestrator** — `_appendEngineManifest()` runs on the flattened write set for **both dry-run and real** install paths (dry-run lists the manifest; rollback removes it). It filters any pre-existing manifest entry out and appends a fresh synthetic `.agents/engine-manifest.json` = `{ engineVersion, engineGitSha, installedFrom, installedAt }`:
  - `engineVersion` = installer's own `package.json` version (`ENGINE_VERSION`, per AC5).
  - `engineGitSha` = resolved SHA (via `_resolveEngineGitSha` → `resolveCommitSha`), or `null` when resolution fails — install proceeds regardless (**D6**).
  - `installedFrom` = `"<owner>/<repo>#<ref>"` (`_getRepositorySlug()` → `owner/repo`, falling back to `"unknown/unknown"`; `ref` = `this.options.version`).
  - `installedAt` = `new Date().toISOString()`.
  - The manifest is **NOT** in `preserveIfExists` — every install/update overwrites it (§3.4).

### 9.4 WP4 — CLI (`cli.ts`)

- New verb **`reflections [status|on|off]`** (default `status`), registered in `COMMAND_FLAGS` (no flags), the `USAGE` block, and the header comment block.
  - `status`: resolves the configured namespace (`getNamespaceId()`), reads the namespace doc, and prints `{ namespace, reflectionsEnabled (absent → true, via `!== false`), engineVersion (or null), engineVersionSource, countForVersion }`. Count is best-effort: `>= 111` displays as `"111+"`; a failed query (pre-deploy) leaves `countForVersion: null` and adds a `note`.
  - `on` / `off`: calls `api.namespaces.setReflectionsEnabled` and prints a confirmation that **reminds the user the sampler band overrides manual state while inside it**.
- No `"quota"` in any output copy.

### 9.5 WP5 — UI (`NamespaceSettings.js`, `useNamespaceSettings.js`, `ChatPanel.js`, `api.js`)

- **`api.js`** registers the new function refs: `namespaces.get`, `namespaces.setReflectionsEnabled`, `reflectionsV2.countForEngineVersion`.
- **`useNamespaceSettings.js`** additionally queries `api.namespaces.get` and exposes `namespace`, `reflectionsEnabled` (absent → true via `!== false`), `reflectionsSaving`, `reflectionsError`, and `setReflectionsEnabled(enabled)` (calls the new mutation). Existing harnessDefaults read/save unchanged.
- **`NamespaceSettings.js`** — new `ReflectionToggleRow` (label "Reflections", sub-caption **"self-arming per engine version"**, no "quota"; writes **immediately** on toggle per **D4**) and `NamespaceLabelPicker` (the header namespace label becomes a clickable dropdown over all namespaces; selecting one calls `onSwitchNamespace`). React.createElement only, Q palette, zero rounded corners; the one review nit (raw `rgba(...)` shadows) was fixed to Q-token shadows.
- **`ChatPanel.js`** passes `namespaces` and `onSwitchNamespace: setSettingsNamespaceId` to the modal; the pre-existing open-flow props (`namespaceId`, `namespaceName`, `allNamespaceIds`) stay, so `handleOpenSettings` is untouched (AC/WP5 open-flow criterion). Dirty harness edits reset on namespace switch (**D5**).

### 9.6 Deviations from spec

None material. Minor, spec-consistent implementation choices worth noting:
- The bounded `.take(111)` count was extracted into the shared helper `countReflectionsForEngineVersion` (one reader for `shouldReflect` + `countForEngineVersion`) rather than inlined twice — a DRY refinement, contract unchanged.
- `_appendEngineManifest` was factored to run on the shared flattened set for both the dry-run and real-install branches, so the manifest appears identically in dry-run output and the real write set.
- `shouldReflect`'s missing-`namespaceId` guard throws `"Job is not reflection-integrated"` (the surrounding code's phrasing) rather than a generic message; behaviour (fail-open catch client-side) is unchanged.
