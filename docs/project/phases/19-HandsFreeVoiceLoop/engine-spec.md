# Hands-Free Voice Loop — Engine Side (Spec)

Phase: `19-HandsFreeVoiceLoop`
Status: Engine architecture aligned with [Phase 22](../22-GuardianCheckpointsVerbatimNotify/guardian-checkpoints-verbatim-notify-spec.md) — verbatim notifications replace the original rendition fork. The original Phase 19 delivery plan is retained below as historical context.
Why-layer: `docs/project/spec/mental-model.md` § "Hands-Free Voice Loop (Mobile)" — global toggle, verbatim message preview, Convex-as-only-pipe, no FCM. Phase 22 §I is the current notification contract.

## Purpose

The user drives conversations from their phone while away from a screen. When the global audio toggle is ON, every Steward assistant message saved through `saveChatResponse` posts to the Convex `notifications` feed, in any thread mode or harness. This includes guardian checkpoint evaluations, final executive assessments, and the messages left by failed, killed, or timed-out chat jobs. The alert and its preview are the product: successful content is sent verbatim, markdown included, with a server-side 5000-character cap. The Android shell subscribes to this feed and posts native notifications. PM-role and user messages never push.

## Overview

Current engine surfaces:

| Surface | Files / integration | Pattern |
|---|---|---|
| Convex backend | `workflow-engine/convex/notifications.ts`, `settings.ts`, additive `schema.ts` tables | `reflectionsV2.ts` module shape |
| Web UI | global audio toggle in `ChatSidebar` header + `api.js` entries + QIcon glyph | existing sidebar controls |
| Runner save path | `runner.ts` → `lib/notify-lib.ts` composer → `notifications.post` | one post attempt after each successful assistant-message save |

The original reflection-style fork/CLI/template triad (`notify-spawn.ts`, `notify.ts`, `templates/notify.md`) is **superseded by Phase 22 and deleted**. Notifications use no child process, agent prompt, session fork, body file, or rendition step. `lib/fork-args.ts` remains for reflections.

External research: skipped deliberately. This is repo-internal refinement using the existing Convex modules and `node:test` conventions.

## Architecture Design

### Data flow (any thread mode or harness)

```
chat job success, failure/kill, or timeout
  → existing job completion/failure mutation
  → saveChatResponse(threadId, content, { hint?, failed? })
      → await chatMessages.add(role: "assistant", content, hint?)
      → only after the message save succeeds:
          await notifications.post({ password, threadId,
            body: composeNotificationBody({ content, hint, failed }) })
          (own try/catch; log errors; no retry)

notifications.post (server):
  → validate password and thread
  → readAudioNotifications(ctx): OFF → return null, no row
  → resolve namespace
  → title = `${namespace.name} · ${thread.title}`
  → insert row with body: args.body.slice(0, 5000)
```

The toggle is checked only on the server; the runner makes no separate toggle query and has no mode, harness, or session gate. Each successful assistant-message save yields one post attempt. A failed message save yields none. User and PM-role inserts use other paths and do not notify.

Notification errors are logged inside the helper's own catch and never enter the chat completion fallback or create another assistant message. The post is awaited but best-effort; this is not a durable delivery/retry guarantee.

### Key components

**1. Convex schema (added in Phase 19; unchanged by Phase 22)**

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
  body: v.string(),                   // composed message verbatim, sliced to ≤5000 chars
  deliveredAt: v.optional(v.number()),// shell ack marker (survives device reinstall)
  createdAt: v.number(),               // display timestamp; NOT the feed cursor
})
  .index("by_thread", ["threadId"]),
  // Feed pagination uses Convex's built-in `by_creation_time` index (`_creationTime`,
  // unique + monotonic) as the collision-safe cursor — no explicit createdAt index needed
  // for the feed. Add `by_created` only if a createdAt-ordered view is separately required.
```

**2. `convex/settings.ts`** (public query and mutation password-gated per existing auth pattern)
- `getAudioNotifications` query → boolean; **absent row ⇒ `false`** (toggle defaults OFF).
- Shared `readAudioNotifications(ctx)` is used by both the query and `notifications.post`; only JSON boolean `true` enables notifications. Absent, malformed, or other values are OFF.
- `setAudioNotifications` mutation `{ enabled: boolean }` — upserts key `"audioNotifications"`.
- Single-user, cross-namespace global by design (mental-model: toggle is the "I'm stepping away" gesture, not per-namespace state).

**3. `convex/notifications.ts`**
- `post` mutation `{ password, threadId, body }` → validates password and thread, checks the global toggle, and returns `null` without inserting when OFF. When ON, resolves the namespace, composes the title, and inserts with exactly `args.body.slice(0, 5000)`. No trimming, markdown stripping, empty-body rejection, or authored compression: empty and whitespace-only strings are valid bodies. Auth/thread/namespace and storage errors are caught by the runner's notification catch.
- `feed` query `{ password, cursor?: <opaque>, limit?: number (default 50, capped) }` → the shell's live-subscription shape: subscribe with the last local cursor, receive "new rows since X" on every invalidation. **Cursor MUST be collision-safe** — a bare `createdAt > since` millisecond cursor can silently drop rows that share a millisecond across a `limit` page boundary, and the LATER Android-shell assignment builds directly on this contract (AC5), so a lossy cursor is expensive to walk back. Use a strictly-monotonic, unique cursor: prefer the row's Convex-native `_creationTime` (unique + monotonic per deployment) as the cursor value, queried over the built-in `by_creation_time` index with `.gt(cursor)`; return an opaque `nextCursor` (last row's cursor value) alongside the rows. (Composite `(createdAt, _id)` with boundary dedup is an acceptable alternative, but `_creationTime` is simpler and eliminates the collision class outright.) Extract the cursor encode/decode + "rows after cursor" boundary logic into a **pure, unit-tested helper** in `lib/notify-lib.ts`; the module documents the consumer contract inline (what the shell stores, what it sends back).
- `markDelivered` mutation `{ password, ids: v.array(v.id("notifications")) }` → stamps `deliveredAt`. The shell acks after posting local notifications; `feed` + cursor stays the primary protocol, `deliveredAt` is the reinstall-safe backstop.

**4. Web UI toggle** — one icon-button, no ceremony. **Exact placement:** the audio toggle is a **global** gesture (single cross-namespace setting), so it does NOT belong in the per-namespace accordion where the existing `config` QIcon lives (`ChatSidebar.js:135`). Place it in the **Conversations thread-list header** (`ChatSidebar.js:461`, currently title + count only) so it is always visible regardless of which namespace is expanded. Implementer confirms the exact line during trace; the invariant is "globally reachable without expanding a namespace."
- New QIcon glyph (suggest `horn` — angular Quake-style sound horn; stroke-based, 24×24, miter joins, zero rounded corners, per QIcon.js conventions; no existing glyph fits).
- State: `useQuery(api.settings.getAudioNotifications)` / `useMutation(api.settings.setAudioNotifications)`. ON = Fullbright torch color (torchFlicker acceptable), OFF = faint bone/stone — mirroring the pin-icon faint/highlighted affordance. `title`/`aria-label` ("Audio notifications on/off"), visible keyboard focus per Design Bar.
- `api.js`: add `settings: { getAudioNotifications: "settings:getAudioNotifications", setAudioNotifications: "settings:setAudioNotifications" }`.

**5. Runner save path and body composer** — `runner.ts` + `lib/notify-lib.ts`:
- `saveChatResponse(threadId, content, opts?: { hint?: string; failed?: boolean })` saves the assistant message, then attempts `notifications.post` inside a separate catch. Notification failure cannot reach the outer chat completion catch. The existing non-throwing chat-save behavior is preserved.
- All seven save paths converge here: `executeChatJob` success, completion-error fallback, failure/kill, and timeout; plus success, failure/kill, and timeout in the legacy `executeJob` chat/product-owner branch. Success passes `{ hint }`; failure/kill/timeout passes `{ hint, failed: true }`. The completion-error fallback already supplies its whole error message as content and passes no options.
- `composeNotificationBody` returns successful content verbatim and ignores success telemetry hints. With `failed: true` and a non-empty hint, it returns `hint + "\n\n" + content`, or just the hint if content is empty. Without a hint it returns content unchanged. Whitespace is preserved; no runner-side trim or truncation occurs.
- Guardian checkpoint responses and final executive assessments use the same assistant save path. Session persistence remains separate and is not a prerequisite for notification posting.
- **HARD GUARDRAIL:** code lands in git only. The live runner process is never restarted, killed, or signaled by any job. The user restarts it themselves post-assignment (mental-model § Self-Modification Awareness).

**6–9. Historical fork tooling and config — superseded by Phase 22.** `notify-spawn.ts`, `notify.ts`, and `templates/notify.md` were deleted. Their child-side toggle lookup, session/harness gates, rendition/compression, temporary body files, and notification-agent timeout no longer apply. `notifyTimeoutMs` was removed from `config.example.json`; the live, gitignored config was left alone. The server owns the 5000-character cap.

### Integration points
- `runner.ts` → `composeNotificationBody` → `notifications.post` → shared `readAudioNotifications`. Feed cursor helpers and `lib/fork-args.ts` remain unchanged; the latter serves reflections only.
- UI ↔ Convex via existing `useConvex` hooks + string-ref `api.js`.
- Phase 22 cutover is owner-only at an idle boundary (no PM group or guardian chat job in flight): deploy Convex first, then immediately restart the runner. No crew job performs deploy, runner restart, or live UAT.

## Historical Phase 19 delivery plan — superseded by Phase 22

**Everything below records the original Phase 19 work packages, tests, acceptance criteria, hand-off, and decisions. It is not current implementation or operating guidance.** In particular, its success-only claude/jam/cook/session gates, detached fork, child toggle check, body trimming/empty rejection, and CLI rendition/compression requirements were superseded by Phase 22 §I. Use the current architecture above and the Phase 22 spec for delivery and validation; original deploy instructions below are historical only.

### Historical Dependency Map

```
WP1 Convex backend (schema + settings.ts + notifications.ts)   ── no deps
WP2 UI toggle (QIcon glyph, ChatSidebar, api.js)               ── needs WP1 function names only
WP3 Engine tooling (lib/notify-lib.ts, lib/fork-args.ts,
    notify.ts, notify-spawn.ts, templates/notify.md,
    runner hook, config example, unit tests)                   ── needs WP1 function names only
WP4 Document job (user hand-off note)                          ── after WP1-3 reviewed
```

WP1–WP3 are internally parallelizable but small enough that **one implement job carries all three** (they share the pattern-mirroring context; splitting would duplicate calibration cost). Convex deploy happens inside that job, after validate is green.

### Historical Work Package Breakdown

#### WP-A (single implement job): backend + UI + engine tooling
Vertical slice: toggle flips in UI → row shape ready in Convex → runner/fork/CLI code in git awaiting user's runner restart.

Deliverables: everything under Architecture Design §1–9, plus unit tests (below), plus Convex prod deploy + `--prod` verification.

**Unit test plan** (node:test via `npx tsx --test`, colocated in `lib/`, mirroring `lib/streams.test.ts` describe/it/assert conventions):
- `lib/fork-args.test.ts` — `buildClaudeForkArgs`: base flag ordering (`--resume <sid> --fork-session -p` last), model flag inserted before resume when present, omitted when absent; exact arg-array equality like the `buildCommand` tests.
- `lib/notify-lib.test.ts` —
  - `shouldNotify`: jam ⇒ true; cook ⇒ true; guardian ⇒ false; missing sessionId ⇒ false; non-claude harness ⇒ false; completion-summary in jam/cook ⇒ true.
  - `prepareBody`: trims whitespace; empty/whitespace-only ⇒ error result; exactly 5000 ⇒ untouched; 5001 ⇒ truncated to 5000 + truncated flag.
  - **feed cursor helper** (the collision-safe encode/decode + "rows after cursor" boundary logic): two rows sharing a `createdAt` millisecond straddling a page boundary are BOTH returned across consecutive cursor calls (no silent drop); empty/undefined cursor ⇒ from the beginning; round-trips `nextCursor`.
- `lib/fork-args.test.ts` additionally: a one-line comment in `fork-args.ts` notes the deliberate divergence from `buildCommand`/reflect-spawn (fork-args intentionally omits `--disallowedTools`; the notify fork adds its own) so a future reader doesn't "fix" it into a regression (A-Low DRY note).
- NO integration tests, NO E2E, NO uat jobs (hard guardrail — live verification is user-owned).

**Success criteria:**
1. `npx tsx .agents/tools/validate/cli.ts` → `ok: true`.
2. New unit tests pass; existing tests untouched and green.
3. `npx convex function-spec --prod` lists `notifications:post|feed|markDelivered` and `settings:getAudioNotifications|setAudioNotifications`; schema diff is purely additive.
4. Code review can trace every cucumber scenario from the north star through the code: toggle OFF ⇒ notify-spawn exits before forking; guardian ⇒ runner gate refuses; assignment jobs ⇒ no call site exists; any failure ⇒ swallowed, thread untouched.
5. `notify.ts --help` output alone is sufficient to drive a correct invocation (reflect.ts parity).
6. UI toggle meets Design Bar (states, focus, aria) and Quake register (QIcon, zero rounded corners, Fullbright ON state).
7. Runner diff is confined to: imports, `maybeSpawnNotification` helper, two `onComplete` call sites. Nothing else in runner.ts changes.

#### WP-B (document job): user hand-off note
Concise note in the assignment's document output:
1. Restart the runner (`run-runner.sh` posture — user-owned step).
2. Flip the audio toggle ON in the sidebar.
3. Send a message in any jam/cook thread; wait for the assistant response.
4. Watch the `notifications` table (Convex dashboard, prod `<convex-deployment>`) for a row within ~1 minute: title `<namespace> · <thread topic>`, listenable body.
5. Flip toggle OFF; confirm the next response produces no row.
6. **Caveat to state explicitly (A-Low):** the audio loop is **claude-harness-only in v1**. Threads running on codex/agy harnesses produce no notification even with the toggle ON, silently — so verify in a claude-backed jam/cook thread.

**Success criteria:** note contains the exact steps above with real paths/URLs; states the claude-only caveat; states explicitly that no crew job performed live verification.

### Historical Assignment-Level Success Criteria
1. All seven north-star acceptance criteria satisfied (verified by review + unit tests, never live).
2. Convex changes additive-only; deployed to prod and verified with `--prod`.
3. Fork spawn cannot block, fail, or pollute the chat job, thread, or OG session — enforced structurally (detached spawn after saves, own try/catch, fail-closed toggle check, output captured nowhere).
4. `notify.ts` is reflect.ts-shaped: `--help` discoverable, single-shot, no retry machinery.
5. Validate CLI green; hand-off note delivered.

### Historical Ambiguities / Decisions Made (original PM record)
1. **Completion summaries notify.** `isCompletionSummary` chat jobs land as assistant responses in jam/cook threads ⇒ included ("every assistant response"); it's also exactly what a stepped-away user wants to hear. Guardian evaluations are excluded by thread mode.
2. **Truncate-not-reject at 5000 chars** (CLI and server). Guarantees delivery; front-loaded punchline makes truncation graceful. A rejected body = silently lost notification. *Superseded 2026-09-03 (user jam, post-live-verification): the CLI now rejects overlong bodies with the measured count so the fork compresses deliberately — authored compression over an unauthored mid-sentence chop. Server-side truncate retained as storage invariant for non-CLI callers.*
3. **Toggle default OFF** when the settings row is absent.
4. **Plain-text body file** instead of reflect's JSON input (single prose payload; avoids known escaping friction). The *interaction pattern* (help/single-shot/validate/file-input) is preserved.
5. **Claude-only fork in v1.** North star names the claude invocation; chat runs on claude in practice. Non-claude chat jobs skip silently at the runner gate.
6. **Jobs-table chat path hooked too** (`jobType chat/product-owner` through `executeJob`) — it saves assistant responses to threads; the hook is one shared-helper call and inert if the path is dormant. Implementer confirms liveness during trace.
7. **New QIcon glyph needed** (no audio glyph exists) — implementer authors one per QIcon conventions.
8. **`deliveredAt` + since-cursor both shipped** — cursor is the subscription protocol, `deliveredAt` the reinstall-safe ack. Cheap to include both now; shell assignment picks its discipline.

### Historical Recommended Job Sequence
1. **implement** (WP-A) — single job; TDD per AOP (tests first for `notify-lib`/`fork-args`); deploys Convex additively; validate green.
2. **review** (fan-out per namespace config) — brief reviewers explicitly on: hard guardrails (no runner-process touch, additive-only schema, no uat), fire-and-forget structural safety, cucumber-scenario traceability, reflect-pattern parity.
3. **implement** (conditional) — only if review finds substantive issues.
4. **document** (WP-B) — user hand-off note; closes the assignment.

No uat job at any point (hard guardrail). No plan job needed beyond this spec.
