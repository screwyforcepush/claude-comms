# Hands-Free Voice Loop — Engine Side (Spec)

Phase: `19-HandsFreeVoiceLoop`
Status: PLANNED
Why-layer: `docs/project/spec/mental-model.md` § "Hands-Free Voice Loop (Mobile)" — read in full before implementing. All settled decisions (global toggle trigger, full-message rendition, reflection-pattern fork, Convex-as-only-pipe, no FCM) live there and are **not** relitigated here.

## Purpose

The user drives jams by voice from their phone while away from a screen. Dictation covers the input half; this assignment builds the engine half of the output: when the global audio toggle is ON, every assistant response in a jam/cook thread is rendered into a listenable notification (by a throwaway session fork) and lands as a row in a new Convex `notifications` feed. A native Android shell (LATER assignment) will subscribe to that feed and post local notifications the phone assistant reads aloud. **This assignment ends at rows landing in Convex.**

## Overview

Five deliverable surfaces, all mirroring the existing reflection ecosystem:

| Surface | New file(s) | Mirrors |
|---|---|---|
| Convex backend | `workflow-engine/convex/notifications.ts`, `settings.ts`, additive `schema.ts` tables | `reflectionsV2.ts` module shape |
| Web UI | global audio toggle in `ChatSidebar` header + `api.js` entries + QIcon glyph | existing sidebar controls |
| Runner hook | small addition in `runner.ts` chat completion paths | `spawnReflection()` call pattern |
| Fork spawner | `.agents/tools/workflow/notify-spawn.ts` | `reflect-spawn.ts` |
| CLI + template | `.agents/tools/workflow/notify.ts`, `templates/notify.md` | `reflect.ts`, `templates/reflect.md` |

External research: skipped deliberately. This is repo-internal refinement — every architectural choice is dictated by an existing, battle-tested in-repo pattern (Convex modules, the reflect fork/CLI/template triad, `node:test` unit conventions). There is no greenfield technology decision to matrix.

## Architecture Design

### Data flow (toggle ON, jam/cook thread)

```
chat job completes (executeChatJob.onComplete, runner.ts:843)
  → chatJobs.complete + saveChatResponse + saveSessionId   (existing, untouched semantics)
  → maybeSpawnNotification(chatContext, sessionId, harness) (new, after saves, own try/catch)
      gate (runner-side, all data already in hand — no new queries):
        sessionId present? · harness === "claude"? · chatContext.mode !== "guardian"?
  → spawn detached: npx tsx notify-spawn.ts <threadId> <sessionId>   (unref'd, never awaited)

notify-spawn.ts (throwaway process, swallows ALL errors — debug log only):
  → query settings:getAudioNotifications → false/error ⇒ exit silently (fail closed)
  → render templates/notify.md ({{THREAD_ID}})
  → claude --dangerously-skip-permissions --verbose --output-format stream-json
        --disable-slash-commands [--model <m>] --resume <sessionId> --fork-session -p
      (prompt via stdin; timeout config.notifyTimeoutMs ?? 5min; SIGTERM→SIGKILL grace
       — identical mechanics to reflect-spawn.ts:52-103)

forked agent (already holds the full response in its session context):
  → npx tsx notify.ts --help          (learns interface)
  → writes rendition body to /tmp/notify-<threadId>.txt
  → npx tsx notify.ts --thread-id <id> --input /tmp/notify-<threadId>.txt
  → exits after "ok"

notify.ts:
  → validates body (non-empty; >5000 chars ⇒ truncate with warning, still post)
  → mutation notifications:post { password, threadId, body }

notifications.post (server):
  → resolves thread → namespace
  → title = `${namespace.name} · ${thread.title}`   (server-side ⇒ AC4 format guaranteed)
  → body re-capped at 5000 (defense in depth; truncate, never reject)
  → insert row
```

Toggle OFF, guardian mode, or assignment (non-chat) jobs: the gate short-circuits — no fork, no row, chat flow untouched. Any failure anywhere downstream of the runner hook is invisible to the thread: the spawn is detached, notify-spawn swallows everything, fork output is captured nowhere.

### Key components

**1. Convex schema (ADDITIVE ONLY — no existing table/index/function touched)**

```ts
settings: defineTable({
  key: v.string(),
  value: v.string(),        // JSON-encoded — mirrors namespaces.harnessDefaults convention
  updatedAt: v.number(),
}).index("by_key", ["key"]),

notifications: defineTable({
  namespaceId: v.id("namespaces"),
  threadId: v.id("chatThreads"),      // deep-link target for the shell
  title: v.string(),                  // "<namespace> · <thread topic>", composed server-side
  body: v.string(),                   // listenable rendition, ≤5000 chars
  deliveredAt: v.optional(v.number()),// shell ack marker (survives device reinstall)
  createdAt: v.number(),
})
  .index("by_created", ["createdAt"])
  .index("by_thread", ["threadId"]),
```

**2. `convex/settings.ts`** (new module; all functions password-gated per existing auth pattern)
- `getAudioNotifications` query → boolean; **absent row ⇒ `false`** (toggle defaults OFF).
- `setAudioNotifications` mutation `{ enabled: boolean }` — upserts key `"audioNotifications"`.
- Single-user, cross-namespace global by design (mental-model: toggle is the "I'm stepping away" gesture, not per-namespace state).

**3. `convex/notifications.ts`** (new module)
- `post` mutation `{ password, threadId, body }` → composes title from thread+namespace, truncates body at 5000, inserts. Throws only on bad threadId/auth (CLI surfaces error; fork dies silently — acceptable, fire-and-forget).
- `feed` query `{ password, since?: number, limit?: number (default 50, capped) }` → rows with `createdAt > since` ascending via `by_created`. This is the shell's live-subscription shape: subscribe with the last local cursor, receive "new rows since X" on every invalidation.
- `markDelivered` mutation `{ password, ids: v.array(v.id("notifications")) }` → stamps `deliveredAt`. The shell acks after posting local notifications; `feed` + cursor stays the primary protocol, `deliveredAt` is the reinstall-safe backstop.

**4. Web UI toggle** — `ChatSidebar` header row (next to the thread-list header, same register as the existing `config` QIcon button): one icon-button, no ceremony.
- New QIcon glyph (suggest `horn` — angular Quake-style sound horn; stroke-based, 24×24, miter joins, zero rounded corners, per QIcon.js conventions; no existing glyph fits).
- State: `useQuery(api.settings.getAudioNotifications)` / `useMutation(api.settings.setAudioNotifications)`. ON = Fullbright torch color (torchFlicker acceptable), OFF = faint bone/stone — mirroring the pin-icon faint/highlighted affordance. `title`/`aria-label` ("Audio notifications on/off"), visible keyboard focus per Design Bar.
- `api.js`: add `settings: { getAudioNotifications: "settings:getAudioNotifications", setAudioNotifications: "settings:setAudioNotifications" }`.

**5. Runner hook** — `runner.ts`, mirroring `spawnReflection` (runner.ts:121-140):
- New `maybeSpawnNotification(threadId, sessionId, mode, harness)`-shaped helper: gate via pure predicate `shouldNotify(...)` (lives in `lib/notify-lib.ts` so it's unit-testable), then detached/unref'd spawn of `notify-spawn.ts <threadId> <sessionId>`. Entire body in try/catch; silent on error.
- Call sites, **after** `saveChatResponse`/`saveSessionId` so the chat flow is already committed:
  - `executeChatJob.onComplete` (runner.ts ~865-875) — the primary path (chatJobs table).
  - `executeJob`'s `isChat` branch `onComplete` (runner.ts ~475-486) — the jobs-table chat path (`jobType === "chat" | "product-owner"`, see `prompts.ts:425`). It also saves assistant responses into threads; hooking it is one extra call of the same helper and harmless if the path is dormant. (Implementer: confirm liveness; keep the hook regardless.)
- Only `onComplete` — never `onFail`/`onTimeout` (a failure/partial is not "an assistant response landing").
- **HARD GUARDRAIL:** code lands in git only. The live runner process is never restarted, killed, or signaled by any job. The user restarts it themselves post-assignment (mental-model § Self-Modification Awareness).

**6. `notify-spawn.ts`** — mirrors reflect-spawn structure (debug-gated logging via `NOTIFY_DEBUG`, `terminate()` SIGTERM→SIGKILL, `runWithTimeout` with stdin prompt + EPIPE guard, `config.notifyTimeoutMs ?? 5min`). Differences from reflect-spawn: argv is `<threadId> <sessionId>` (no Convex job lookup needed — the runner already vetted mode/harness/session); the only Convex call is the toggle check (fail **closed**, unlike shouldReflect's fail-open — a lost notification is acceptable, a spurious fork is waste). Claude-only fork per the north star's named invocation; extension to codex/agy can copy reflect-spawn's dispatch later if chat ever runs non-claude.

**7. `notify.ts` CLI** — mirrors reflect.ts interaction pattern exactly: `--help` teaches everything, single invocation, validates input, one Convex write, prints `ok`, no retry/parsing machinery. Flags: `--thread-id <id> --input <path>` (+ `--help`). Input is a **plain UTF-8 text file** holding the body — deliberate deviation from reflect's JSON: the payload is one prose string, and JSON-escaping a 5k prose blob is exactly the `cli-shell-escaping` friction reflection data keeps flagging. Validation: file exists; non-empty after trim; >5000 chars ⇒ truncate + stderr warning + still post (delivery over perfection — the punchline is front-loaded by contract, so truncation degrades gracefully). Shared `MAX_BODY_CHARS = 5000` constant in `lib/notify-lib.ts`.

**8. `templates/notify.md`** — reflector-POV, mirrors reflect.md register. Content:
- Framing: "You just posted a response in a conversation. The user is away from their screen and will *hear* this as a notification. Render **your previous response** (your most recent assistant message — it is in your context) into a listenable notification body." No thread/namespace names needed in the template — the title is composed server-side, and the forked session already contains the message.
- Rendition contract, baked in verbatim from the north star: full substance, same voice, NOT a summary; strip code blocks, tables, URLs, markdown syntax noise; reference artifacts/files by name, never quote code; hard cap ~5000 chars; front-load the punchline — first ~200 chars are the collapsed preview and must carry the headline.
- Prohibitions: do not post to the thread, do not modify project files, output is captured nowhere.
- Submission steps (mirroring reflect.md): run `notify.ts --help` → write body to `/tmp/notify-{{THREAD_ID}}.txt` → invoke once → exit after `ok`.
- Template var: `{{THREAD_ID}}` only.

**9. Config** — `config.json`/`config.example.json`: optional `notifyTimeoutMs` (mirrors `reflectionTimeoutMs`).

### Integration points
- `runner.ts` ← `lib/notify-lib.ts` (`shouldNotify`) — only runner file touched.
- `notify-spawn.ts` ← `lib/fork-args.ts` (new: pure `buildClaudeForkArgs({ sessionId, model? })` extracted from reflect-spawn's inline `runClaude` args; `reflect-spawn.ts` refactored to consume it, behavior-identical — reflect-spawn is spawned fresh per job via npx tsx, so this is safe and never touches the running runner).
- UI ↔ Convex via existing `useConvex` hooks + string-ref `api.js`.
- Deploy: Convex additive deploy from **repo root** (root `convex` symlink must exist), `CONVEX_DEPLOYMENT=prod:utmost-vulture-618 npx convex deploy`; verify with `npx convex function-spec --prod` that `notifications:*` and `settings:*` are live (dev deployment reads lie — always `--prod`). Verify functions are bundled before deploying (empty-functions deploy = data loss).

## Dependency Map

```
WP1 Convex backend (schema + settings.ts + notifications.ts)   ── no deps
WP2 UI toggle (QIcon glyph, ChatSidebar, api.js)               ── needs WP1 function names only
WP3 Engine tooling (lib/notify-lib.ts, lib/fork-args.ts,
    notify.ts, notify-spawn.ts, templates/notify.md,
    runner hook, config example, unit tests)                   ── needs WP1 function names only
WP4 Document job (user hand-off note)                          ── after WP1-3 reviewed
```

WP1–WP3 are internally parallelizable but small enough that **one implement job carries all three** (they share the pattern-mirroring context; splitting would duplicate calibration cost). Convex deploy happens inside that job, after validate is green.

## Work Package Breakdown

### WP-A (single implement job): backend + UI + engine tooling
Vertical slice: toggle flips in UI → row shape ready in Convex → runner/fork/CLI code in git awaiting user's runner restart.

Deliverables: everything under Architecture Design §1–9, plus unit tests (below), plus Convex prod deploy + `--prod` verification.

**Unit test plan** (node:test via `npx tsx --test`, colocated in `lib/`, mirroring `lib/streams.test.ts` describe/it/assert conventions):
- `lib/fork-args.test.ts` — `buildClaudeForkArgs`: base flag ordering (`--resume <sid> --fork-session -p` last), model flag inserted before resume when present, omitted when absent; exact arg-array equality like the `buildCommand` tests.
- `lib/notify-lib.test.ts` —
  - `shouldNotify`: jam ⇒ true; cook ⇒ true; guardian ⇒ false; missing sessionId ⇒ false; non-claude harness ⇒ false; completion-summary in jam/cook ⇒ true.
  - `prepareBody`: trims whitespace; empty/whitespace-only ⇒ error result; exactly 5000 ⇒ untouched; 5001 ⇒ truncated to 5000 + truncated flag.
- NO integration tests, NO E2E, NO uat jobs (hard guardrail — live verification is user-owned).

**Success criteria:**
1. `npx tsx .agents/tools/validate/cli.ts` → `ok: true`.
2. New unit tests pass; existing tests untouched and green.
3. `npx convex function-spec --prod` lists `notifications:post|feed|markDelivered` and `settings:getAudioNotifications|setAudioNotifications`; schema diff is purely additive.
4. Code review can trace every cucumber scenario from the north star through the code: toggle OFF ⇒ notify-spawn exits before forking; guardian ⇒ runner gate refuses; assignment jobs ⇒ no call site exists; any failure ⇒ swallowed, thread untouched.
5. `notify.ts --help` output alone is sufficient to drive a correct invocation (reflect.ts parity).
6. UI toggle meets Design Bar (states, focus, aria) and Quake register (QIcon, zero rounded corners, Fullbright ON state).
7. Runner diff is confined to: imports, `maybeSpawnNotification` helper, two `onComplete` call sites. Nothing else in runner.ts changes.

### WP-B (document job): user hand-off note
Concise note in the assignment's document output:
1. Restart the runner (`run-runner.sh` posture — user-owned step).
2. Flip the audio toggle ON in the sidebar.
3. Send a message in any jam/cook thread; wait for the assistant response.
4. Watch the `notifications` table (Convex dashboard, prod `utmost-vulture-618`) for a row within ~1 minute: title `<namespace> · <thread topic>`, listenable body.
5. Flip toggle OFF; confirm the next response produces no row.

**Success criteria:** note contains the exact five steps above with real paths/URLs; states explicitly that no crew job performed live verification.

## Assignment-Level Success Criteria
1. All seven north-star acceptance criteria satisfied (verified by review + unit tests, never live).
2. Convex changes additive-only; deployed to prod and verified with `--prod`.
3. Fork spawn cannot block, fail, or pollute the chat job, thread, or OG session — enforced structurally (detached spawn after saves, own try/catch, fail-closed toggle check, output captured nowhere).
4. `notify.ts` is reflect.ts-shaped: `--help` discoverable, single-shot, no retry machinery.
5. Validate CLI green; hand-off note delivered.

## Ambiguities / Decisions Made (flag to PM — overturn by decision record if wrong)
1. **Completion summaries notify.** `isCompletionSummary` chat jobs land as assistant responses in jam/cook threads ⇒ included ("every assistant response"); it's also exactly what a stepped-away user wants to hear. Guardian evaluations are excluded by thread mode.
2. **Truncate-not-reject at 5000 chars** (CLI and server). Guarantees delivery; front-loaded punchline makes truncation graceful. A rejected body = silently lost notification.
3. **Toggle default OFF** when the settings row is absent.
4. **Plain-text body file** instead of reflect's JSON input (single prose payload; avoids known escaping friction). The *interaction pattern* (help/single-shot/validate/file-input) is preserved.
5. **Claude-only fork in v1.** North star names the claude invocation; chat runs on claude in practice. Non-claude chat jobs skip silently at the runner gate.
6. **Jobs-table chat path hooked too** (`jobType chat/product-owner` through `executeJob`) — it saves assistant responses to threads; the hook is one shared-helper call and inert if the path is dormant. Implementer confirms liveness during trace.
7. **New QIcon glyph needed** (no audio glyph exists) — implementer authors one per QIcon conventions.
8. **`deliveredAt` + since-cursor both shipped** — cursor is the subscription protocol, `deliveredAt` the reinstall-safe ack. Cheap to include both now; shell assignment picks its discipline.

## Recommended Job Sequence
1. **implement** (WP-A) — single job; TDD per AOP (tests first for `notify-lib`/`fork-args`); deploys Convex additively; validate green.
2. **review** (fan-out per namespace config) — brief reviewers explicitly on: hard guardrails (no runner-process touch, additive-only schema, no uat), fire-and-forget structural safety, cucumber-scenario traceability, reflect-pattern parity.
3. **implement** (conditional) — only if review finds substantive issues.
4. **document** (WP-B) — user hand-off note; closes the assignment.

No uat job at any point (hard guardrail). No plan job needed beyond this spec.
