# Phase 17 — Config-Driven `validate` CLI

**Status:** Spec / Planning
**Author:** Planning Architect
**North Star:** Ship a config-driven `validate` CLI at `.agents/tools/validate/` that runs a repo's quality gates concurrently with single-flight dedup, replacing the hand-rolled `nohup`+pid-poll recipe agents reinvent every job to satisfy `AOP.VALIDATE`.
**Scope surfaces (hard boundary — FOUR):** `.agents/tools/validate/` (new) · `.agents/repo.md` (rewire) · `.agents/AGENTS.md` (trim obsoleted `[VALIDATE]` recipe, lines 52-54 — see D7) · `packages/setup-installer/src/orchestrator/installer.js` (+ its test) — nothing else.

> **Scope correction (D7):** the North Star asserted "`.agents/AGENTS.md` needs NO edit (it already delegates to repo.md)." Pre-implementation review falsified that premise: `AGENTS.md` `[VALIDATE]` lines 52-54 embed their **own concrete nohup/process-check recipe** that directly contradicts the new blocking-only CLI (line 54 "Run the commands nohup" would *detach* the validate CLI and trip the agent idle timeout). PM authorized `AGENTS.md` as a fourth surface for a **minimal surgical trim** (lines 52-54 only; line 47 delegation and line 55 "NEVER git stash" stay). See §6 D7, §7 WP-B.

---

## 1. Purpose (Why this exists)

`AOP.VALIDATE` (`.agents/AGENTS.md`) **mandates** running lint/typecheck/test/build, but ships **no tool** — only a four-`nohup` recipe in `.agents/repo.md`. Per the mental model (`docs/project/spec/mental-model.md` → *Agent Operating Environment — Harness Override & Tooling Levers*):

> **A mandate without a tool authors friction.** Agents faithfully hand-roll the mandated recipe, and that hand-rolling *is* the friction. The fix is to ship the tool the mandate already assumes exists, then retarget the mandate at it.

Reflection data shows this is the single highest-volume "kludged-bash" friction in the corpus: every pm/plan/review job reinvents `nohup pnpm <gate> &` + manual PID polling + log-grepping. We ship the tool: **one BLOCKING command** that runs all configured gates concurrently, dedups across parallel agents sharing a worktree, and returns machine-readable pass/fail keyed on **exit codes** (never text parsing). The agent reads `ok`; on failure it opens only the failing gate's log.

A second principle this realizes — **Deploy-Parity Validation**: validation should exercise the project *the same way a deployment builds it*, so "green locally" cannot diverge from "deploys clean." One deploy-parity build gate per client (see §6, D2).

---

## 2. Overview (What is being built)

A self-contained tool directory `.agents/tools/validate/` invoked via `npx tsx` (same idiom as sibling `.agents/tools/workflow/cli.ts`), with **zero new npm dependencies** (node `child_process` + `fs` only):

| File | Role |
|---|---|
| `cli.ts` | CLI surface: arg parsing, `--help`/`--status`/`--gates`, stdout JSON, exit code. Thin shell over the engine. **The ONLY layer that writes stdout/stderr and calls `process.exit`.** |
| `validate.ts` | Engine lib: `runValidate(config, opts)` — lock/latch/reap, concurrent gate spawning, result stamping. **RETURNS results/errors only — never writes stdout/stderr, never calls `process.exit`** (so it is unit-testable in isolation; the TDD seam). Progress is surfaced via an injected callback the CLI maps to stderr. |
| `config.json` | **Committed**, sane default gates for THIS repo. Loaded `JSON.parse(readFileSync(join(__dirname,"config.json")))`. |
| `config.example.json` | Generic template gates for client customization. |
| `validate.test.ts` | `node:test` suite, run via `npx tsx --test`. |
| `README.md` | `--help`-first interface doc, mirroring sibling tool READMEs. |

Plus three out-of-dir edits: `.agents/repo.md` `[VALIDATE]` rewired to call the CLI; `.agents/AGENTS.md` `[VALIDATE]` lines 52-54 (the nohup/process-check recipe) trimmed (D7); `packages/setup-installer/src/orchestrator/installer.js` `preserveIfExists` extended so client configs survive re-install.

### Behavioural contract (from the cucumber scenarios)

```
npx tsx .agents/tools/validate/cli.ts            # run/latch ALL gates (blocking)
npx tsx .agents/tools/validate/cli.ts --gates lint,test   # subset
npx tsx .agents/tools/validate/cli.ts --status   # read last result, no run
npx tsx .agents/tools/validate/cli.ts --help     # interface + configured gate list
```

Result JSON (stdout):
```json
{
  "ok": false,
  "runId": "1733664000000-7af3c1",
  "gateKey": "build,lint,test,ts:check",
  "head": "ff7fffa7…",
  "dirty": true,
  "latched": false,
  "startedAt": 1733664000000,
  "finishedAt": 1733664042000,
  "gates": {
    "lint":     { "status": "passed", "exitCode": 0,    "signal": null,     "log": "/tmp/claude-comms-validate/runs/1733664000000-7af3c1/lint.log" },
    "ts:check": { "status": "passed", "exitCode": 0,    "signal": null,     "log": "/tmp/claude-comms-validate/runs/1733664000000-7af3c1/ts:check.log" },
    "test":     { "status": "passed", "exitCode": 0,    "signal": null,     "log": "/tmp/claude-comms-validate/runs/1733664000000-7af3c1/test.log" },
    "build":    { "status": "failed", "exitCode": 1,    "signal": null,     "log": "/tmp/claude-comms-validate/runs/1733664000000-7af3c1/build.log" }
  }
}
```
Per-gate shape: `{ status: "passed"|"failed", exitCode: number|null, signal: string|null, log: string }`. `signal` is non-null only when the gate was killed by a signal (`exitCode===null`), in which case `status==="failed"` (§3.5). Top-level `runId` + `gateKey` are the latch identity (§3.3, D8/D9). Per-gate `log` paths are **runId-scoped and immutable** (`runs/<runId>/<gate>.log`) so a later run can never clobber a latcher's logs (D8).

Process exit code = `0` iff every gate passed. Per-gate completion lines stream to **stderr** as progress (`✓ lint (3.1s)`, `✗ build (exit 1)`), keeping stdout a clean single JSON document. (Engine returns the object; `cli.ts` does the stdout/stderr/exit — §2 file table.)

---

## 3. Architecture Design

### 3.1 State layout (all under `config.logDir`, default `/tmp/claude-comms-validate/`)

```
/tmp/claude-comms-validate/
  lock/                              # the lock — created atomically with fs.mkdirSync (EEXIST ⇒ held)
    meta.json                        # { pid, runId, gateKey, head, dirty, startedAt } — written atomically (tmp+rename INTO lock/)
  runs/
    <runId>/                         # IMMUTABLE per-run artifacts (never overwritten by a later run — D8)
      result.json                    # this run's stamped result, published atomically (tmp+rename)
      <gate>.log                     # this run's per-gate verbose stdout+stderr
  result.json                        # "latest": a full COPY of the most-recent run's result, atomically rewritten (tmp+rename) each run, for --status to emit directly; NEVER read by latchers (they read runs/<runId>/result.json)
```

`runId` = `${startedAt}-${rand}` (e.g. `1733664000000-7af3c1`), sampled **once** at acquire and threaded verbatim into `meta.json` and the run's `result.json` (the linchpin of the latch match — D8/med "single-source"). `rand` = 6 hex chars derived without `Math.random` dependence on determinism — e.g. `process.hrtime.bigint()` low bits or `crypto.randomBytes(3).toString("hex")` (node builtin, zero new deps) — to defeat same-millisecond `startedAt` reuse.

**Why runId-scoped artifacts (D8):** a single global `result.json` + fixed `<gate>.log` paths can be overwritten by a fast *subsequent* owner before a latcher reads them → the latcher gets the wrong run's result or a torn log. Immutable `runs/<runId>/` artifacts close that window; latchers poll **their target run's** `runs/<runId>/result.json`, never the global pointer. Retention: `runs/` lives under the container-ephemeral `/tmp`; no GC in v1 (each client container's `/tmp` is wiped on container teardown — keeping per-run dirs cheap and avoiding a "result deleted before latcher read it" race).

No repo-tree writes, no `.gitignore` change (North Star constraint). Each client container has its own `/tmp`, so **no cross-repo lock keying is required** — a single fixed `logDir` is correct.

### 3.2 Tree-state capture (graceful)

Before acquiring the lock, the owner computes:
- `head` = `git rev-parse HEAD` (trimmed) — `null` if git unavailable / not a repo.
- `dirty` = `git status --porcelain` non-empty → `true`, empty → `false`, `null` if git unavailable.

Git failures degrade to `null`/keep-going (never hard-fail). `head`/`dirty` — together with the `runId` and `gateKey` sampled **once** at acquire (§3.1) — are stamped into `lock/meta.json` and threaded verbatim into the final `result.json` (single-source; the linchpin of the latch match, D5/D8).

### 3.3 Single-flight latch (the #1 design risk)

Latch is on the **whole suite**, not per-gate. Two roles emerge from one atomic primitive. The identity that ties an owner, its meta, and its published result together is **`runId` + `gateKey`** (a sorted, comma-joined list of the selected gate names) — both sampled **once** at acquire and threaded verbatim everywhere (§3.1). `startedAt` alone is NOT a safe identity (millisecond reuse), and `gateKey` is what makes `--gates` subsets and the all-gates run distinguishable (D9).

**Acquire** — `fs.mkdirSync(logDir/lock)` (NOT `recursive:true` — that hides `EEXIST`):
- **Success ⇒ OWNER.** *Immediately* publish `meta.json` **atomically into the lock**: write `lock/meta.json.tmp.<pid>` then `fs.renameSync` → `lock/meta.json`. Contents `{pid, runId, gateKey, head, dirty, startedAt}`. (Atomic publish means a contender never observes a half-written meta — it sees either no meta or the complete object; see §3.4 grace for the no-meta window.)
- **`EEXIST` ⇒ contend** → read `lock/meta.json` and branch to reap-or-latch (§3.4).
- **`EACCES` / lock-dir uncreatable (TRUE lock-infrastructure failure ONLY)** ⇒ **graceful un-latched fallback**: warn to stderr, run gates un-coordinated (`latched:false`), never hard-fail (North Star graceful-degradation). **This fallback is reserved for lock-infra failure ONLY — never for ordinary contention** (D-fallback, §3.4). To guarantee it never clobbers a coordinated run's artifacts, the un-latched run writes to **pid-suffixed isolated paths**: `runs/unlatched-<pid>/result.json` and `runs/unlatched-<pid>/<gate>.log` (it publishes no shared `meta.json` and does not touch a coordinated `runs/<runId>/`).

**Owner run sequence (ordering is load-bearing):**
1. Spawn all selected gates concurrently (§3.5), await all. Logs stream to `runs/<runId>/<gate>.log`.
2. Build stamped result `{ok, runId, gateKey, head, dirty, latched:false, startedAt, finishedAt, gates}` — `runId`/`gateKey`/`startedAt` are the SAME values sampled at acquire, not re-sampled.
3. **Publish the run's result atomically** to its immutable path: write `runs/<runId>/result.json.tmp` → `fs.renameSync` → `runs/<runId>/result.json` — *before* releasing the lock. Then atomically rewrite the top-level `result.json` as a full copy of this result (tmp+rename) so `--status` can emit it directly.
4. **Release** lock: `fs.rmSync(logDir/lock, {recursive:true, force:true})`.
5. (cli.ts) emit result to stdout; `process.exit(ok ? 0 : 1)`.

Step 3-before-4 guarantees: when a latcher observes the lock gone, **its target run's** `runs/<runId>/result.json` is already present (the latcher keys on `runId`, so a *different* later run releasing its lock cannot fool it).

### 3.4 Reap vs latch (contender path)

On `EEXIST`, the whole contender path runs in a **bounded re-contention loop** (each iteration: read meta → classify → reap-and-reacquire OR latch; loop back on any "I lost the race" or "owner abandoned" signal), bounded by `config.timeoutMs`. **On timeout: exit with a clear coordination error (non-zero) — NEVER spawn a duplicate run** (North Star single-flight; D-fallback). The only path that runs un-latched is the §3.3 `EACCES` lock-infra fallback.

Read `lock/meta.json` and classify:

**(a) Missing / malformed meta — GRACE, do not reap immediately.** There is an unavoidable window where a just-acquired lock dir exists before its owner's atomic meta-rename lands. Reaping here would kill a live owner mid-init (the acquire/meta TOCTOU). Rule: a lock is reapable-on-bad-meta only if meta is missing/malformed on **two reads separated by `config.pollIntervalMs`** AND the **lock dir's `mtime`/`birthtime` is older than `config.metaGraceMs`** (a small multiple of `pollIntervalMs`). If the second read shows valid meta → re-classify (b)/(c)/(d). If still bad but the lock dir is young → keep latch-waiting/looping (owner still initializing), do not reap.

**(b) Stale by dead PID** — `process.kill(meta.pid, 0)` throws `ESRCH` ⇒ owner dead ⇒ reap. (`EPERM` ⇒ alive, do not reap.) **Best-effort only:** PID reuse can make a dead owner's recycled PID look alive; age (c) is the authoritative backstop, not dead-PID detection.

**(c) Stale by age** — `Date.now() - meta.startedAt > config.staleLockMs` ⇒ reap. `staleLockMs` MUST exceed the realistic worst-case suite duration so a healthy-but-slow owner is never age-reaped mid-run (D10; reconciled in §3.7).

**(d) Live & fresh, gate-set matches ⇒ LATCH** (below). **Live & fresh but gate-set MISMATCH** (`meta.gateKey !== my gateKey`) ⇒ **do NOT latch and do NOT reap** — an all-gates caller must not latch a subset run, nor vice-versa, nor cross two different subsets (D9). Keep contending: loop back (wait `pollIntervalMs`, re-read) until the owner releases, then acquire for my own gate-set. (No projection, no superset-satisfies-subset.)

**ATOMIC REAP (rename-to-claim — replaces non-atomic `rmSync`-then-`mkdir`).** Two contenders both seeing a stale lock must not each `rmSync` and `mkdir` — contender B's `rmSync` would delete contender A's *freshly re-acquired* live lock ⇒ silent double ownership. Instead **seize atomically**:
  1. `fs.renameSync(lock, lock.reaping.<pid>)` — directory rename is atomic on a single fs (same `/tmp`); **exactly one reaper wins**. The loser gets `ENOENT` ⇒ it did not seize ⇒ loop back and re-contend (someone else is handling it).
  2. Winner: `fs.rmSync(lock.reaping.<pid>, {recursive:true, force:true})` to discard the stale contents.
  3. Winner: `fs.mkdirSync(lock)` to re-acquire. **Only if this `mkdirSync` succeeds is the reaper the new owner**; `EEXIST` ⇒ a third party acquired first ⇒ loop back and re-contend. On success, proceed as OWNER (§3.3: publish meta atomically, then run).
  Reapers NEVER `rmSync(lock)` directly — the rename is the serialization point.

**LATCH (case d):**
  1. Capture the target identity `{runId, gateKey, pid}` from `meta.json`.
  2. **Liveness-checked poll** (interval `config.pollIntervalMs`, default 250 ms; bounded by `config.timeoutMs`). Each tick:
     - If `runs/<target.runId>/result.json` exists → read it, set `latched:true`, return (cli.ts: emit, exit `result.ok?0:1`). (Latcher reads the **target run's immutable result**, never the global pointer — D8.)
     - Else re-read `lock/meta.json` to verify the latched-onto run is still live:
       - **Lock gone** (`ENOENT` on meta) → do a final check for `runs/<target.runId>/result.json`; if present, serve it; if absent, the owner **died without publishing** ⇒ ABANDON this latch and **re-contend** (loop back to acquire — this contender may become the new owner). Never hang.
       - **Lock present but `meta.runId !== target.runId`** (owner was reaped+replaced by a third agent) → final check for the *target's* result; if absent, ABANDON and re-contend.
       - **Owner PID dead** (`process.kill(target.pid,0)` ⇒ `ESRCH`) and no result after grace → ABANDON and re-contend (the owner crashed; let the reap path take over).
     - Else continue polling.
  3. **Timeout terminal behavior:** if `config.timeoutMs` elapses with neither a target result nor a successful re-contention, exit with a coordination error (non-zero) — defined, never a hang/throw, never a duplicate run.
  - **No drift re-run in v1**: the latcher serves the stamped result *even if HEAD moved during the wait*. It does **not** compare its own HEAD to the result's.

### 3.5 Concurrent gate execution

Per gate, from `config.gates` (`{name, command}`):
- `spawn(command, { shell: true, cwd: repoRoot, stdio: ['ignore', logFd, logFd] })` where `logFd` is an fd opened on `runs/<runId>/<gate>.log` (immutable per-run path, §3.1). Commands are shell strings (e.g. `npm --prefix … run lint`, `cd … && vercel build`), so `shell:true` is required; output is redirected **straight to the per-gate log file** (no in-memory buffering, no read-back).
- `repoRoot` = `join(__dirname, "../../..")` (the CLI lives at `.agents/tools/validate/`), so gate commands run from repo root regardless of the agent's cwd.
- Resolve each gate's promise on the **`close`** event (not `exit`) so the log file is fully flushed: `{name, exitCode: code, signal, status: code===0 ? "passed":"failed", log}`. A signal-kill yields `code===null` (with `signal` set) ⇒ treat as **failed**, record the `signal` string (and `exitCode:null`). The `signal` field is `null` on a normal exit.
- `await Promise.all(gatePromises)` — blocks until the **slowest** finishes. **Never detaches / backgrounds** (a detached run trips the agent idle timeout; the agent's tool-call stays active for the suite duration — North Star).
- `ok = gates.every(g => g.status === "passed")`.
- `runValidate()` **returns** this rolled-up result object; it does not print or exit — `cli.ts` owns stdout/stderr/exit (§2).

> **Verdict = exit code only.** No parsing of tool stdout. Per-gate error-count is explicitly OUT of v1. Warning-vs-error strictness lives in the client's command (e.g. `eslint --max-warnings 0`), not the runner.

### 3.6 CLI surface (mirror the toolkit `--help`-first idiom)

| Invocation | Behaviour | Exit |
|---|---|---|
| (default) | Run/latch **all** configured gates | `0` iff all passed |
| `--gates lint,test` | Run/latch only the named subset (order-independent; unknown name → error) | `0` iff selected passed |
| `--status` | Read+emit last `result.json` **without running** (no spawn, no lock); `{status:"none"}` if absent | `0` (read op) |
| `--help` | Print interface + the configured gate list from `config.json` | `0` |

### 3.7 Config shape

`config.json` (committed, THIS repo — see §6 D2 for gate rationale):
```json
{
  "logDir": "/tmp/claude-comms-validate",
  "pollIntervalMs": 250,
  "metaGraceMs": 2000,
  "staleLockMs": 1800000,
  "timeoutMs": 2400000,
  "gates": [
    { "name": "lint",     "command": "npm --prefix packages/setup-installer run lint" },
    { "name": "ts:check", "command": "npx tsc --noEmit -p workflow-engine/convex/tsconfig.json" },
    { "name": "test",     "command": "npx tsx --test .agents/tools/validate/*.test.ts" },
    { "name": "build",    "command": "cd workflow-engine/ui && npx vercel build --yes" }
  ]
}
```

**Timing-constant invariant (D10 reconcile).** The four time constants are ordered:

`pollIntervalMs` (250 ms) `<` `metaGraceMs` (2 s ≈ 8 polls — bounds the acquire/meta init window, §3.4a) `≪` worst-case suite duration `<` `staleLockMs` (30 min — age-reap backstop) `<` `timeoutMs` (40 min — latcher max wait).

Rationale: the **previous values were inverted** — `staleLockMs` 15 min `<` `timeoutMs` 30 min meant a healthy-but-slow owner whose suite ran past 15 min would be **age-reaped mid-run**. D10 fix: `staleLockMs` must exceed the realistic worst-case suite duration (raised to 30 min), and `timeoutMs` (the latcher's wait bound) must be ≥ `staleLockMs` so a latcher does not abandon a legitimately-slow-but-healthy owner before that owner could even be deemed stale (raised to 40 min). Dead-PID reap (§3.4b) is best-effort; **age is the authoritative backstop**. (If a client's suite can exceed 30 min, raise `staleLockMs`/`timeoutMs` proportionally, or a future version adds an owner heartbeat — `lastHeartbeatAt` in meta — and stales on heartbeat age instead; heartbeat is OUT of v1 scope.)

`config.example.json` — same shape, generic `pnpm` placeholder gates for clients to edit post-install.

---

## 4. Data Flows

```
agent ──npx tsx cli.ts──▶ parse args ──▶ load config.json
                                              │
                          ┌───────────────────┴───────────────────┐
                     --status?                                 run/latch
                          │                                        │
                  read result.json                      capture head/dirty (git, graceful)
                  emit, exit 0                                      │
                                          mkdirSync(lock) ─EEXIST─▶ read meta (loop, ≤timeoutMs)
                                              │success │EACCES         │
                                              ▼        ▼          ┌────┴───────────────┬──────────────┐
                                            OWNER   un-latched  bad-meta+old      dead-pid/aged    live&fresh
                                       publish meta  (pid-iso     /gate mismatch       │          + gate match
                                       (tmp+rename     paths)        │              REAP (atomic): │
                                        INTO lock/)                  │           renameSync(lock,  LATCH (liveness poll):
                                              │                   re-contend      lock.reaping.pid) poll runs/<runId>/result.json
                                     spawn gates (shell,            (loop)        winner: rm+mkdir   ├─ result? serve, latched:true
                                     cwd=repoRoot,→runs/<runId>/log)              ENOENT/EEXIST →    ├─ lock gone/runId≠/pid dead
                                              │                                   re-contend (loop)  │     → abandon, re-contend
                                     write runs/<runId>/result.json (tmp+rename)                     └─ timeout → coordination err
                                     update top-level result.json pointer                exit(ok?0:1)
                                     rmSync(lock); (cli) emit, exit(ok?0:1)
```

---

## 5. Dependency Map & Parallelization

Three work packages map onto the four scope surfaces (WP-B owns two: `repo.md` + `AGENTS.md`). The dependency edges:

```
WP-A (validate tool core) ──── CLI contract ────▶ WP-B (repo.md rewire + AGENTS.md trim)
        │
        └── config.json path only ──▶ WP-C (installer no-overwrite)   [∥ parallel with WP-A]
```

- **WP-A is the critical path** (engine + CLI + config + tests + README).
- **WP-C** depends *only* on the agreed path string `.agents/tools/validate/config.json` — it can run **fully in parallel** with WP-A.
- **WP-B** depends on WP-A's **finalized CLI invocation string** (so the AOP points at the real command). Start once §2/§3.6 are locked (which this spec does) — so WP-B can also proceed in parallel, then a 1-line reconcile if the invocation changes.

**Recommendation:** WP-A and WP-C concurrently; WP-B authored against this spec's §3.6 contract and reconciled at integration.

---

## 6. Decisions

**D1 — config.json is committed with defaults; client edits post-install.** Keeping client configs updated over time is OUT of scope. (North Star D1.)

**D2 — EXACTLY ONE build gate: `vercel build` (UI deploy-parity), not `pnpm build`.**
Investigation of THIS repo's real surface:
- The `pnpm lint/ts:check/test/build` commands in `repo.md` **do not exist** here — root `package.json` has empty `scripts`, there is no `pnpm-workspace.yaml`. They are generic template boilerplate (`repo.md` is in the no-overwrite/client-customized set).
- Real deploy surfaces: (a) npm-publish of `packages/setup-installer` — CI (`.github/workflows/publish-claude-comms.yml`) runs `eslint` + `node scripts/build.js`; (b) Convex backend `convex deploy` — typechecked; (c) **static UI → Vercel deploy**, gated by `vercel build --yes` per `repo.md` "PRE Deployment".
- The documented divergence ("`pnpm build` passed but the Vercel deploy later failed") **is** the UI surface. `setup-installer`'s `build` is a file-copy (`scripts/build.js`) — it cannot catch a Vercel failure. Therefore the deploy-parity build gate is **`cd workflow-engine/ui && npx vercel build --yes`**; we do NOT also ship a `pnpm build`/installer-build gate.
- The other surfaces remain covered by *non-build* gates: `ts:check` = `tsc --noEmit` over the Convex tsconfig (deploy-parity for the backend); `lint` = the setup-installer eslint that CI enforces.

**D3 — Test gate runs the tool's own `tsx --test` suite.** The repo's TS tests already run via `npx tsx --test` (see `.agents/tools/workflow/lib/*.test.ts`); jest in `setup-installer` is flaky and disabled in CI. The committed `test` gate = `npx tsx --test .agents/tools/validate/*.test.ts` (implementer may broaden to `.agents/tools/**/*.test.ts` if all pass green).

**D4 — `--status` always exits 0.** It is a read operation; the verdict is carried in the payload's `ok`. Avoids conflating "the read succeeded" with "the last run passed."

**D2-hardened — never commit an always-red gate; verify deploy-parity green in THIS container before commit.** `vercel build` stays the committed deploy-parity gate, BUT every committed `config.json` gate MUST be verified green-or-expected-pass in this container before commit (a default that can never go green poisons the tool's credibility and every downstream client). If `vercel build` cannot run headlessly, substitute the **closest runnable UI-build parity gate** (the static build step `vercel build` wraps for this `React.createElement` UI) as the committed default and **surface the trade-off to PM** — do NOT silently drop deploy-parity. The auth/link prerequisite is documented in `README.md` either way. (Resolution executed in WP-A step 6; see §10-Q1.)

**D5 — Latch identity = `runId` + `gateKey` (supersedes "by `startedAt`").** `startedAt` alone is unsafe (same-ms reuse) and gives `--gates` no way to distinguish a subset run from an all-gates run. Identity is `runId` (`${startedAt}-${rand}`) plus a sorted `gateKey`, sampled ONCE at acquire and threaded verbatim into `meta.json` and the run's `result.json` (§3.1, §3.3). The latcher matches its target run's immutable `runs/<runId>/result.json`, never the global pointer (§3.4).

**D6 — Installer edit lives in `src/`, not `dist/`.** `packages/setup-installer/package.json` has `"main": "src/index.js"` and `bin` requires `../src/index.js`; `dist/` contains no orchestrator. Only `src/orchestrator/installer.js` (and its jest test) need editing.

**D7 — `.agents/AGENTS.md` is an AUTHORIZED 4th scope surface (corrects the North Star's "no AGENTS.md edit" premise).** After the repo.md rewire, `AGENTS.md` `[VALIDATE]` lines 52-54 still carry the obsoleted shared-worktree recipe ("check running processes" + "Run the commands nohup and pipe to log file"). Line 54's "Run the commands nohup" would cause an agent to **detach** the validate CLI — a direct violation of the blocking-only mandate (a detached run trips the agent idle timeout). WP-B performs a **minimal surgical trim** of lines 52-54 only. Line 47 ("Run required commands from repo.md") legitimately delegates and STAYS; line 55 ("NEVER git stash") STAYS. The North Star's "delegates only" premise was incomplete (52-54 embed the obsoleted recipe); review falsified it; PM authorized the trim.

**D8 — Concurrency model upgraded to runId-keyed IMMUTABLE per-run artifacts + atomic-rename reap.** A single global `result.json` / fixed `<gate>.log` can be clobbered by a fast subsequent owner before a latcher reads them. Fix: publish to immutable `runs/<runId>/result.json` + `runs/<runId>/<gate>.log`; top-level `result.json` is a "latest" pointer for `--status` only (§3.1). `meta.json` is written atomically (tmp+rename INTO `lock/`) to close the acquire/meta TOCTOU, with a **grace re-read** before any missing/malformed-meta reap (§3.4a). Stale-lock reaping is an **atomic rename-to-claim** (`renameSync(lock, lock.reaping.<pid>)`) — exactly one reaper wins, the loser gets `ENOENT` and re-contends; the non-atomic `rmSync`-then-`mkdir` is removed (§3.4). The latcher does a **liveness re-check** each poll (lock gone / `runId` changed / owner PID dead ⇒ abandon + re-contend) with a **defined timeout** terminal behavior (coordination error, never hang) (§3.4 LATCH).

**D9 — Latch ONLY on EXACT gate-set match.** A latcher latches only when `meta.gateKey` equals its own sorted `gateKey`. Any mismatch (all-gates vs subset, or two different subsets) is treated as non-matching → contend/queue for its own run. No projection, no superset-satisfies-subset, no cross-latch (§3.4d).

**D-fallback — un-latched run is reserved for TRUE lock-infrastructure failure ONLY (`EACCES`/uncreatable lock dir).** Ordinary contention/races NEVER trigger a second run (that would violate the North Star: "a 2nd validator must not trigger a 2nd run"). On contention the contender keeps reaping/latching until `timeoutMs`, then exits with a coordination error. The `EACCES` un-latched run writes pid-isolated artifacts so it cannot clobber a coordinated run (§3.3).

**D10 — `staleLockMs` must exceed worst-case suite duration; age is the authoritative reap backstop.** The previous `staleLockMs` (15 min) `<` `timeoutMs` (30 min) let a healthy slow owner be age-reaped mid-run. Reconciled: `staleLockMs`=30 min `>` worst-case suite, `timeoutMs`=40 min `≥` `staleLockMs` (§3.7 invariant). Dead-PID reap is best-effort (PID reuse); age is authoritative. Owner heartbeat is a documented future option, OUT of v1.

---

## 7. Work Package Breakdown (UAT vertical-slice focus)

### WP-A — Validate tool core (engine + CLI + config + tests + README)

TDD mandatory. Write `validate.test.ts` FIRST (red), then `validate.ts` + `cli.ts` (green).

**Build order:**
1. `config.json` + `config.example.json` (the contract).
2. `validate.test.ts` — the §8 cases (T1–T13) (red).
3. `validate.ts` engine: tree-state, atomic-meta lock/atomic-rename-reap/liveness-latch, concurrent spawn, immutable runId publish. `runValidate()` returns results/errors only (no stdout/stderr/exit — that is cli.ts).
4. `cli.ts`: arg parse, `--help`/`--status`/`--gates`, stderr progress, stdout JSON, exit code.
5. `README.md`.
6. **Verify each committed gate actually exits cleanly in this container before commit (D2-hardened — HARD RULE).** Run every `config.json` gate; **never commit an always-red default.** If `vercel build` cannot go green headlessly (auth/link), substitute the closest runnable UI-build parity gate (the static build `vercel build` wraps) as the committed default and **surface the trade-off to PM** — do NOT silently drop deploy-parity. Document the auth/link prerequisite in `README.md` regardless. *(Success criterion, not optional.)*

**UAT vertical slice:** From a clean checkout, `npx tsx .agents/tools/validate/cli.ts` runs all four gates concurrently, blocks, prints one JSON doc with per-gate `{status,exitCode,log}` + top-level `ok`, exits non-zero iff any gate failed. A second concurrent invocation latches (`latched:true`) onto the first and both receive the same result.

**Success criteria:**
- [ ] `.agents/tools/validate/` contains `cli.ts`, `validate.ts`, `config.json`, `config.example.json`, `validate.test.ts`, `README.md`.
- [ ] Zero new npm deps (only `node:child_process`, `node:fs`, `node:path`, `node:os`).
- [ ] All §8 tests (T1–T13) pass via `npx tsx --test .agents/tools/validate/validate.test.ts`.
- [ ] Verdict derives solely from gate exit codes; no stdout parsing anywhere.
- [ ] stdout is exactly one JSON document; per-gate logs under `logDir`; progress lines on stderr.
- [ ] CLI exit code = 0 iff all selected gates pass.
- [ ] `--help`/`--status`/`--gates <subset>` behave per §3.6.
- [ ] Graceful degradation: no-git → `head/dirty:null` & gates still run; lock-dir-uncreatable → warn + run un-latched.
- [ ] Committed `config.json` gates verified runnable in this repo (or constraint documented per §10-Q1).

### WP-B — AOP rewire (`.agents/repo.md` + `.agents/AGENTS.md` trim — D7)

**Two surfaces** (the North Star's "AGENTS.md no-edit" premise was falsified by review — D7):

1. **`.agents/repo.md`:** replace the four-`nohup` `[VALIDATE]` recipe (lines 3-7) with an instruction to run the validate CLI and, on `ok:false`, open only the failing gate's `log`.
2. **`.agents/AGENTS.md`:** **minimal surgical trim of lines 52-54 only** — the "check running processes before running…" + "Run the commands nohup and pipe to log file" guidance that the blocking-only CLI obsoletes (and whose `nohup` would *detach* the CLI, violating the North Star). **Keep line 47** ("Run required commands from repo.md" — legitimate delegation) and **keep line 55** ("NEVER `git stash`"). Replace 52-54 with a one-line pointer that the validate CLI is blocking and self-coordinating (single-flight), so no manual process-check/nohup is needed.

**UAT vertical slice:** An agent reading `repo.md` `[VALIDATE]` (and `AGENTS.md` `[VALIDATE]`) is directed to one blocking command and a clear "on failure, open the failing gate's log" rule — **no pid-poll / nohup recipe remains in either file**.

**Success criteria:**
- [ ] `repo.md` `[VALIDATE]` calls `npx tsx .agents/tools/validate/cli.ts` (matching §3.6 exactly).
- [ ] Instructs reading `ok`, opening only the failing gate's `log` on `ok:false`.
- [ ] No `nohup … &` / PID-poll recipe remains in `repo.md`.
- [ ] `AGENTS.md` lines 52-54 (nohup/process-check recipe) removed; line 47 delegation and line 55 "NEVER git stash" preserved.
- [ ] No `nohup`/detach guidance for the validate flow remains in `AGENTS.md`.

### WP-C — Installer no-overwrite (`packages/setup-installer`)

Add `.agents/tools/validate/config.json` to the `preserveIfExists` array in `src/orchestrator/installer.js` (currently `installer.js:341` — alongside `.claude/settings.local.json`, `.agents/repo.md`, `.agents/tools/chrome-devtools/config.json`). Mirror the existing skip test in `test/unit/orchestrator/installer.test.js` (the `repo.md` / `chrome-devtools/config.json` cases near line 47).

**UAT vertical slice:** In a throwaway temp dir with a pre-existing `.agents/tools/validate/config.json`, running the installer preserves it (logs "skipping (preserving user customizations)"); in a dir without it, the file is installed. **Do NOT run `npx claude-comms` in this project** — verify in a temp dir.

**Success criteria:**
- [ ] `preserveIfExists` includes `.agents/tools/validate/config.json`.
- [ ] `installer.test.js` has a passing case asserting the file is skipped when present and written when absent.
- [ ] Behaviour confirmed in a throwaway temp dir (not in this repo).
- [ ] No other installer behaviour changed.

---

## 8. Test Plan (TDD — write first)

`validate.test.ts`, `node:test` + `node:assert`, run `npx tsx --test`. Pattern mirrors `lib/file-tracker.test.ts` (tmpdir `logDir` per case, cleanup in `after`). Tests import `validate.ts`'s `runValidate(config, opts)` directly with **trivial fast gates** (`node -e "process.exit(0)"`, `node -e "process.exit(3)"`, short `sleep`) so no real 60 s gate runs.

| # | Case | Assertion |
|---|---|---|
| T1 | **Exit-code → `ok` rollup** | Gates `[pass(exit0), fail(exit3)]` → `ok===false`, `gates.pass.status==="passed"`/`exitCode 0`, `gates.fail.status==="failed"`/`exitCode 3`. All-pass config → `ok===true`. |
| T1b | **Signal-kill → failed** | Gate `node -e "process.kill(process.pid,'SIGKILL')"` → `exitCode===null`, `signal` non-null, `status==="failed"`, `ok===false`. |
| T2 | **Latch dedup (shared worktree)** | Two concurrent `runValidate` on one `logDir` with a slow gate that appends to a counter file → counter incremented **once**; exactly one result `latched:false`, the other `latched:true`; both share identical `runId`/`gateKey`/`head`/`startedAt`/`ok`. |
| T3 | **`--gates` subset** | 4-gate config, `gates:["lint"]` → only `lint` spawned; `result.gates` contains only selected gate(s); `gateKey==="lint"`. |
| T4 | **`--status`** | With a prior latest `result.json` → emits it, **no gate spawned**, exit 0. With none → `{status:"none"}`, exit 0. |
| T5 | **Stale-lock reaping — dead PID** | Pre-create `lock/meta.json` with a dead PID → run reaps lock (atomic rename-to-claim), becomes owner, completes `latched:false`. |
| T6 | **Stale-lock reaping — aged** | Pre-create `lock/meta.json` with `startedAt` older than `staleLockMs` (live-looking pid) → reaped, owner takes over. |
| T7 | **Graceful degradation** | (a) run in a non-git tmp dir → `head===null`, `dirty===null`, gates still run, `ok` correct. (b) `EACCES`/lock dir un-creatable → warns + runs un-latched (`latched:false`) to **pid-isolated** paths. |
| T8 | **Two-reaper race → exactly one wins** | Two contenders both seeing one stale lock → atomic `renameSync` seize means exactly ONE reaps+re-acquires+runs (counter incremented once); the loser re-contends and latches. No double ownership. |
| T9 | **Latcher recovers when owner dies without publishing** | Pre-create a live-looking `lock/meta.json` (target `runId`) but never publish `runs/<runId>/result.json`; then remove the lock mid-poll → latcher ABANDONS and re-contends (becomes owner / completes), **does NOT hang** to `timeoutMs`. |
| T10 | **Gate-set mismatch does not cross-latch** | Owner in-flight with all gates; a `--gates lint` contender (different `gateKey`) does NOT latch the all-gates result — it contends and runs its own `lint`-only run once the owner releases. (And vice-versa: subset owner does not satisfy an all-gates request.) |
| T11 | **Immutable per-run result/log isolation** | Run A publishes `runs/<runIdA>/`; a subsequent Run B publishes `runs/<runIdB>/` → A's `result.json` and `<gate>.log` are byte-unchanged after B completes (no clobber). |
| T12 | **CLI `--help`** | `--help` prints the interface + the configured gate list from `config.json`, exit 0, **no gate spawned, no lock taken**. |
| T13 | **CLI all-gates concurrency + blocking** | Default invocation spawns all configured (fast) gates **concurrently** (overlap observable via timestamps/marker files) and the call **blocks** until the slowest finishes before returning the single JSON doc; exit 0 iff all pass. |

**TDD coverage of mandated cases (North Star):** latch dedup = T2; exit-code→`ok` = T1; `--gates` = T3; `--status` = T4; stale-lock reaping = T5+T6. **Concurrency-correctness (review fixes):** atomic reap two-reaper race = T8; latcher liveness/no-hang = T9; gate-set exact-match (D9) = T10; immutable runId artifacts (D8) = T11; signal-kill = T1b. **CLI surface:** `--help` = T12; all-gates concurrency/blocking = T13. All gates are trivial/fast (`node -e`, short `sleep`/marker-file) — **no real 60 s gate runs**.

---

## 9. Assignment-Level Success Criteria

- [ ] `npx tsx .agents/tools/validate/cli.ts` runs all configured gates **concurrently**, **blocks** to completion, emits per-gate `{status,exitCode,log}` + top-level `ok`, exits non-zero iff any gate failed.
- [ ] Second concurrent invocation **latches** (no second run), waits, receives the same stamped result with `latched:true`. Ordinary contention NEVER spawns a duplicate run; only a TRUE lock-infra failure (`EACCES`) runs un-latched (pid-isolated) (D-fallback).
- [ ] Latch identity is `runId`+`gateKey` (D5/D9); exact gate-set match only — no subset↔all-gates cross-latch.
- [ ] Stale locks (dead PID **or** age > `staleLockMs`) are reaped via **atomic rename-to-claim** (exactly one reaper wins); `staleLockMs` > worst-case suite duration (D10).
- [ ] Latcher does a **liveness re-check** and recovers (re-contends) if the owner dies without publishing or is replaced — never hangs; timeout → coordination error (D8).
- [ ] Per-run artifacts are **immutable** (`runs/<runId>/result.json` + `<gate>.log`); a later run cannot clobber a latcher's result/log (D8).
- [ ] Result carries `head` + `dirty`; latcher served stamped result even if HEAD moved (no v1 drift re-run).
- [ ] Gates are config-driven (`{name,command}`, order-independent); `config.json` committed with verified defaults.
- [ ] Zero new npm deps; verdict from exit codes only; per-gate error-count out of scope.
- [ ] Blocking only — never detaches/backgrounds; logs under `/tmp`, no repo-tree writes, no `.gitignore` change.
- [ ] Exactly one build gate (`vercel build`, D2) — not duplicated; verified green-or-expected-pass in this container before commit (D2-hardened — never commit an always-red default).
- [ ] `--gates` / `--status` / `--help` surface present; graceful no-git & no-lock degradation.
- [ ] `.agents/repo.md` `[VALIDATE]` rewired to the CLI; `.agents/AGENTS.md` lines 52-54 (nohup/process-check recipe) trimmed, lines 47 & 55 preserved (D7).
- [ ] `npx claude-comms` preserves an existing `.agents/tools/validate/config.json` (verified in temp dir).
- [ ] All `validate.test.ts` cases (T1–T13) green.
- [ ] Changes confined to the **four** scope surfaces — no other files.

---

## 10. Ambiguities / Questions for the implementer

- **Q1 — Headless `vercel build` (D2).** The deploy-parity build gate is `vercel build`, but the CLI may require auth/project-linking that is unavailable in a headless agent container. **Resolution path:** during WP-A step 6, run the gate; if it cannot exit cleanly headless, keep it as the committed gate (it *is* the deploy-parity gate) and document the auth prerequisite in `README.md`, OR — if the user prefers a guaranteed-green default — substitute the closest runnable parity gate and note the trade-off. *Surface the outcome to PM.* Do not silently drop the deploy-parity gate.
- **Q2 — `test` gate scope (D3).** Committed as the validate tool's own suite. Broaden to `.agents/tools/**/*.test.ts` only if every existing suite is green in this container (verify, don't assume).
- **Q3 — `ts:check` resolution.** `npx tsc -p workflow-engine/convex/tsconfig.json` must resolve the `typescript` devDep (it lives under `workflow-engine/`). Implementer verifies `npx tsc` resolves from `repoRoot` cwd; if not, use `npm --prefix workflow-engine exec -- tsc --noEmit -p convex/tsconfig.json`.
- **Q4 — Installer raw-URL fallback omits `.agents/tools/*` (FLAGGED to PM — possible 5th surface, NOT edited).** *Verified finding:* the installer's governing delivery paths **do** ship `.agents/tools/validate/`: the primary `fetchRepository` → `fetchAsTarball` filters `actualPath.startsWith('.agents/')` wholesale (`github.js:915,920`), and the Strategy-2 `fetchDirectory('.agents')` Trees API (`github.js:234`) and Contents API (recursive) likewise deliver the whole subtree. **Only the deepest fallback** `_fetchWithRawUrls` (`github.js:301-368`, reached *only* if tarball **and** Trees **and** Contents all fail) hardcodes a `knownFiles` list (`github.js:336-337`) containing just `.agents/AGENTS.md` + `.agents/repo.md` — it would omit `tools/validate/`. **Crucially this is a PRE-EXISTING gap**: that same hardcoded list already omits *every* existing `.agents/tools/*` dir (`chrome-devtools`, `workflow`, `agent-job`), so `validate/` introduces no new bug class and the phase is at parity with the current baseline. **Recommendation: do NOT edit `github.js` in this phase** (it is a 5th file, a pre-existing-bug fix, and out of the North Star's scope boundary). If PM wants the raw-URL last-resort hardened to enumerate the tools dirs, that is a separate, sign-off-gated work item. *Reported in the plan summary per VERIFY-AND-FLAG.*

---

## 11. Recommended Job Sequence

1. **implement** WP-A (TDD: tests red → engine/CLI green) and **implement** WP-C **in parallel** (independent surfaces). WP-B (repo.md + AGENTS.md trim) authored against §3.6 alongside.
2. **review** (fan-out) — focus on the now-hardened concurrency core: atomic-meta acquire (§3.3) → immutable runId publish-before-release (§3.3) → atomic-rename-to-claim reap (§3.4) → liveness-checked latch with defined timeout (§3.4) → `EACCES`-only un-latched fallback (D-fallback); plus exit-code purity (no stdout parsing), `staleLockMs`>suite invariant (§3.7), and scope confined to the **four** surfaces.
3. **uat** — exercise the §7 vertical slices: real concurrent double-invoke on this repo (latch), `--status`/`--gates`/`--help`, and the installer skip in a throwaway temp dir.

Place UAT **after** review so the latch/reap edge cases are reasoned-about before manual concurrency testing.

---

**Spec doc path:** `docs/project/phases/17-ValidateCLI/validate-cli-spec.md`
