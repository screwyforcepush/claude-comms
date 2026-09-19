# Chat Message Attachments (Spec)

Phase: `21-ChatAttachments`
Status: PLANNED (2026-09-19)
Why-layer: `docs/project/spec/mental-model.md` → "UI Mental Model" → "Message Attachments" (plus "Draft Persistence", "Security Model", "Self-Modification Awareness"). Read before implementing. Settled there and in the north star, **not relitigated here**: attachments ride the message as a structured field; privacy equals the chat's privacy (password-gated fetch, never a public storage URL); no count/total-size cap, one per-file transport cap (~20 MB) treated as a warning only.

## Self-surgery constraint (HARD — every job in this chain)

This assignment edits the engine that is running it. The runner executes `.agents/tools/workflow/cli.ts` **from the working tree** on every chat job, the UI dev server serves `workflow-engine/ui/` straight from the working tree, and the Convex backend is the one the runner talks to.

- **No `uat` jobs. No deploy (`convex deploy`, `vercel build`, Vercel trigger). No runner restart, harness kill, or interruption of in-flight jobs. No browsertools or any live exercise of the UI or Convex.** A job that believes it needs one of these blocks with the reason instead.
- Chain is **implement → review (→ document)**. The user deploys and tests live after review. Reviewed code on `main` is the finish line.
- Cold unit tests inside the validate gate are expected (TDD). They must not touch the runner, the live deployment, or a browser.
- Everything additive and backward compatible: the new message field is optional; existing function signatures unchanged (new optional args only); the CLI gains a command without changing any existing one; old UI + old backend + old runner keep working while the new code lands.
- **`cli.ts` is live the moment it is saved.** A half-edited `cli.ts` breaks every chat job that starts during that window (tsx compiles it per invocation). Rule for the implementer: build and test the new code path in a **new** file first (`lib/attachments.ts`), then land the `cli.ts` wiring as **one atomic Edit** (import + `COMMAND_FLAGS` entry + `case` + usage text in a single tool call), then re-run `npx tsx .agents/tools/workflow/cli.ts help` immediately to prove it still parses. Same discipline for `workflow-engine/ui/js/**` (served live on port 3000): run `node --check <file>` after each edit; never leave a UI file syntactically broken between tool calls.
- Convex edits are inert until the user deploys, so backend ordering is free — but `ts:check` (the validate gate) must stay green.

## Verification performed before planning (assignment "VERIFY BEFORE PLANNING")

| Question | Finding | Evidence |
|---|---|---|
| Convex HTTP action response-size limit | **20 MiB** response body (docs also say ~20 MB request). Installed `convex` is **1.31.2** (`workflow-engine/node_modules`). | docs.convex.dev/production/state/limits; docs.convex.dev/functions/http-actions |
| `ctx.storage.get` available in `httpAction`? | **Yes.** `httpAction` is exported from `convex/_generated/server.d.ts:96`; its ctx is `GenericActionCtx` whose `storage: StorageActionWriter` has `get(storageId): Promise<Blob \| null>` (`dist/esm-types/server/storage.d.ts:130`). A `Blob` can be returned directly as a `Response` body. `storage.delete` exists on `StorageWriter` (usable in mutations). | installed package types |
| HTTP actions host | Served on the deployment's **`.convex.site`** host; `.convex.cloud` is the function/realtime API. | docs.convex.dev/production/abuse-protection |
| Router supports what we need? | `ROUTABLE_HTTP_METHODS` includes `GET` and `OPTIONS`; `pathPrefix` routes supported (`router.d.ts:11,62`). HEAD is normalized to GET. | installed package types |
| How `chatThreads.remove` cascades today | Step 3 of `remove` collects `chatMessages` via `by_thread` and deletes each row (`chatThreads.ts:492`). Blob cleanup slots in **inside that loop**, before `ctx.db.delete(message._id)`. No other cascade (retryGroup, delete-assignment) touches `chatMessages`. | `workflow-engine/convex/chatThreads.ts` |
| Where the agent's prompt gets the user message | `chatJobs.trigger` and `chatThreads.fork` write `latestUserMessage` into the chat job context; `prompts.ts#buildChatPrompt` appends it verbatim as `**User says:**` (and `{{LATEST_MESSAGE}}` only in guardian/completion sections, which carry PM reports, never user attachments). **Runner and `prompts.ts` need no change.** | `chatJobs.ts:90`, `chatThreads.ts:177`, `prompts.ts:418` |
| Existing `chatMessages.add` callers | UI `ChatPanel.js`, CLI `chat-send`, Android `ReplyMarshaler.kt` — all pass `{threadId, role, content}` only. An optional `attachments` arg breaks none. | grep |
| Service worker interference with the gated fetch | `sw.js:35` is network-only for any hostname containing `convex` — `.convex.site` fetches bypass the cache. No CSP in `vercel.json`/`index.html`. | `workflow-engine/ui/sw.js`, `vercel.json` |
| Validate gate coverage of cold tests | The `test` gate currently runs **only** `.agents/tools/validate/*.test.ts`. The existing `.agents/tools/workflow/lib/*.test.ts` and `workflow-engine/convex/lib/*.test.ts` are green when run together (93/93, 2026-09-19) — widening the gate is safe and is part of WP-1. `config.json` is git-tracked. | `.agents/tools/validate/config.json`, run log |
| Can a buildless UI helper be cold-tested? | **Yes** — `npx tsx --test` imports a plain ESM `.js` from `workflow-engine/ui/js/` fine (probe against `api.js` passed). | in-container probe |
| `ts:check` scope | `convex/tsconfig.json` includes `./**/*.ts` → `http.ts`, `lib/attachments.ts` and its test are all type-checked by the gate. | tsconfig |

External research: limited to the Convex facts above (Perplexity, domain-restricted to docs.convex.dev, cross-checked against installed package types). Everything else is repo-internal refinement traced from source; no library choices are being made (no new dependencies anywhere).

## Purpose

The user jams with the Steward by chat and constantly has things the agent cannot see: a screenshot of the UI being described, a finance spreadsheet, a contract PDF. This phase gives the chat input the affordance every modern chat has (drop / paste / "+" pick), makes the attachment part of the message and part of the draft, tells the agent exactly how to fetch each file with the toolkit it already holds credentials for, and keeps every byte behind the same admin password as the rest of the chat.

## Overview

| Surface | Change | Kind |
|---|---|---|
| `workflow-engine/convex/schema.ts` | `chatMessages.attachments?: {filename, storageId, size, mime}[]` | additive schema |
| `workflow-engine/convex/lib/attachments.ts` (new) + `.test.ts` | Pure contract module: block renderer, filename sanitiser, byte formatter, route/header/command constants, header builders, path parser, size limit | pure, cold-tested |
| `workflow-engine/convex/chatMessages.ts` | `add` accepts optional `attachments`; new `discardAttachment` mutation | additive |
| `workflow-engine/convex/chatJobs.ts` | `trigger` renders the block into `latestUserMessage` | additive (identity when no attachments) |
| `workflow-engine/convex/chatThreads.ts` | `fork` accepts optional `attachments` and renders the block; `remove` cascades blob deletion | additive |
| `workflow-engine/convex/http.ts` (new) | `GET /attachments/<storageId>` + `OPTIONS`, bearer-password gated | new entry point |
| `.agents/tools/workflow/lib/attachments.ts` (new) + `.test.ts` | Site-URL derivation, request builder, verdict mapping, contract test against the Convex lib | pure, cold-tested |
| `.agents/tools/workflow/cli.ts` | New `attachment-fetch <storageId> --out <path>` command + help text | additive, one atomic edit |
| `.agents/tools/validate/config.json` | Widen `test` gate globs | gate |
| `workflow-engine/ui/js/api.js` | `files.generateUploadUrl`, `chatMessages.discardAttachment` refs | additive |
| `workflow-engine/ui/js/components/chat/attachmentUtils.js` (new) + `workflow-engine/ui/test/attachmentUtils.test.ts` (new) | Pure helpers: site URL, fetch URL/headers, oversize check, image check, byte format, draft (de)serialisation | pure, cold-tested |
| `workflow-engine/ui/js/components/chat/ChatPanel.js` | Draft model becomes `{text, attachments}`; upload/remove/discard owned here; send + fork carry attachments | additive |
| `workflow-engine/ui/js/components/chat/ChatView.js` | Pass-through of new props | additive |
| `workflow-engine/ui/js/components/chat/ChatInput.js` | "+" picker, drag-drop, paste, pending list, uploading gate, >20 MB warning | additive |
| `workflow-engine/ui/js/components/chat/MessageBubble.js` | Chips + inline image preview via gated fetch | additive |
| `workflow-engine/ui/styles.css` | Drop-state / chip / pending-list styles (Q palette, zero radius) | additive |
| Docs | `docs/project/spec/workflow-engine-spec.md` (chatMessages dictionary + function table), `workflow-engine-ui-spec.md` (chat flow, draft persistence item 7), `password-wall.md` (new entry point), `.agents/tools/workflow/README.md` + root `README.md` (chat commands) | docs |

Not touched: `runner.ts`, `harness-executor.ts`, `prompts.ts`, `templates/*.md`, `files.ts` (reused as-is), Android shell, `notifications.ts`.

## Architecture Design

### 1. Data model (AC1, AC9)

```ts
// schema.ts — chatMessages
attachments: v.optional(v.array(v.object({
  filename: v.string(),          // original name as the user's OS reported it (display only)
  storageId: v.id("_storage"),
  size: v.number(),              // bytes, as reported by the browser File
  mime: v.string(),              // File.type, or "application/octet-stream" when empty
}))),
```

No index changes. No backfill (absent = no attachments). No server-side validation of count or size (AC9). `chatMessages.add` spreads `attachments` into the insert only when the array is non-empty (same pattern as `hint`), so rows never carry an empty array.

### 2. The agent-facing block (AC2)

Rendered **server-side** into `latestUserMessage` by both `chatJobs.trigger` and `chatThreads.fork` via one pure function; `prompts.ts` then carries it into the prompt unchanged under `**User says:**`. Rendered only when attachments exist — zero prompt cost otherwise.

Why server-side (decision matrix — settled in jam, recorded for the reviewer):

| Option | Purpose fit | Testability | Compat / blast radius | Verdict |
|---|---|---|---|---|
| Render in `chatJobs.trigger` + `chatThreads.fork` (server) | Both send paths covered by one function; runner/prompts untouched | Pure function, cold test | Zero runner change → no restart needed (hard constraint) | **Selected** |
| Render in `prompts.ts#buildChatPrompt` (runner) | Same output | Cold-testable | Requires `chatContext.attachments` **and** a runner restart to take effect — forbidden | Rejected |
| New CLI command the agent must call to list attachments | Works | Testable | Adds a tool call and a prompt rule; contradicts "the message it already receives names each file" | Rejected |

`renderAttachmentsBlock(content, attachments)` in `workflow-engine/convex/lib/attachments.ts` — exact format (stable; the CLI contract test asserts the command line):

```
<prose exactly as sent>

---
**Attachments (2)** — password-gated, not public. Fetch with the workflow toolkit, then Read the local file.
1. screenshot.png — image/png, 184.2 KB — storageId kg2abc123
   npx tsx .agents/tools/workflow/cli.ts attachment-fetch kg2abc123 --out /tmp/attachments/screenshot.png
2. Q3 budget.xlsx — application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, 1.4 MB — storageId kg2def456
   npx tsx .agents/tools/workflow/cli.ts attachment-fetch kg2def456 --out /tmp/attachments/Q3-budget.xlsx
```

Rules: prose first (verbatim, untrimmed); empty prose → block only (no leading blank lines); `--out` is a **suggested** path built from `safeFilename()` (strip path separators and control chars, spaces → `-`, ≤120 chars, fallback `attachment`; duplicates within one message get `-2`, `-3`); files over the transport cap get a trailing line `   ⚠ over 20 MB — the fetch route cannot serve this; ask the user for a smaller file` and still list the command. `formatBytes` uses 1024-based units with one decimal.

### 3. Gated HTTP route (AC3) — `workflow-engine/convex/http.ts`

Contract (mirrored as constants in all three packages and pinned by the contract test):

| Item | Value |
|---|---|
| Path | `GET /attachments/<storageId>` (router `pathPrefix: "/attachments/"`), optional `?filename=<name>` (display name only, non-secret) |
| Auth | `Authorization: Bearer <ADMIN_PASSWORD>` header. Reuses `requirePassword({ password })` from `auth.ts`; "Unauthorized" → **401** `text/plain`; "Server misconfigured" → 500. Password **never** read from the query string. |
| Not found | `storage.get` returns null, or the id fails Convex id validation (caught) → **404** |
| Bad request | Empty id segment → **400** |
| Too large | `blob.size > ATTACHMENT_MAX_BYTES (20 × 1024 × 1024)` → **413** with a plain-text reason (checked before building the response so the verdict is ours, not a runtime error) |
| Success | **200**, body = the Blob; `Content-Type: blob.type \|\| application/octet-stream`; `Content-Length`; `Content-Disposition: inline; filename*=UTF-8''<rfc5987-encoded name>` (name = `?filename` sanitised, else storageId); `Cache-Control: private, no-store`; `X-Content-Type-Options: nosniff` |
| CORS | Browser callers (Vercel origin, `localhost:3000`) send a non-simple header → preflight. `OPTIONS /attachments/*` → 204 with `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, OPTIONS`, `Access-Control-Allow-Headers: Authorization`, `Access-Control-Max-Age: 86400`. GET responses also carry `Access-Control-Allow-Origin: *` and `Access-Control-Expose-Headers: Content-Disposition, Content-Length`. Wildcard origin is safe: there are no cookies; the bearer password is the whole gate. |
| Other methods | Not routed → Convex default 404 |

Header choice (decision): `Authorization: Bearer` over a custom `X-Admin-Password`. Same preflight cost; `Authorization` is the header logging/proxy tooling conventionally redacts, and it needs no bespoke name to be discovered. Constant `ATTACHMENT_AUTH_SCHEME = "Bearer"`.

Pure, cold-tested helpers (in `convex/lib/attachments.ts`): `parseAttachmentPath(pathname) → storageId | null`, `bearerFrom(headerValue) → string | null`, `contentDispositionFor(name)`, `attachmentResponseHeaders({mime, size, name})`, `corsHeaders()`. `http.ts` itself is a thin adapter over these plus `ctx.storage.get` and is not unit-tested (needs the Convex runtime — no live exercise allowed).

`files.getDownloadUrl` and `ctx.storage.getUrl` are **never** called for chat attachments (leave `files.ts` for the APK hand-off). Reviewer check: grep `getUrl` — only `files.ts`.

### 4. Toolkit CLI command (AC4) — `attachment-fetch`

```
attachment-fetch <storageId> --out <path>    Fetch a chat attachment to a local file (password-gated)
```

- `COMMAND_FLAGS["attachment-fetch"] = ["out"]`; `--out` required (error verdict if missing). Parent directory is created (`mkdirSync recursive`). Writes bytes with `writeFileSync`.
- Site URL: `deriveSiteUrl(config.convexUrl)` → `https://<slug>.convex.cloud[/]` ⇒ `https://<slug>.convex.site`; any other shape ⇒ `null`. Optional additive config key `convexSiteUrl` overrides derivation (for self-hosted/custom domains); absence changes nothing for existing configs.
- Request: `GET <site>/attachments/<storageId>` with `Authorization: Bearer <config.password>` using global `fetch` (Node 20, no new dependency). Never logs the password.
- **Single verdict per call** (mental-model tool-verdict principle): success → one JSON on stdout `{ ok: true, storageId, out: <absolute path>, bytes, contentType }` exit 0; failure → the existing `error()` path (one JSON `{ error }` on stderr, exit 1) with an **actionable** message from `describeFetchFailure(status, siteUrl)`:
  - 401 → `Unauthorized: config.json password does not match the deployment's ADMIN_PASSWORD`
  - 404 → `Attachment <id> not found — it was removed, or the storageId is wrong`
  - 413 → `Attachment exceeds the 20 MB fetch limit; ask the user to re-share a smaller file`
  - site derivation failed → `Cannot derive the HTTP-actions host from convexUrl "<url>"; set "convexSiteUrl" in config.json`
  - network error → `Cannot reach <site>: <err.message>`
  - anything else → `Fetch failed with HTTP <status>`
- Pure module `.agents/tools/workflow/lib/attachments.ts`: `deriveSiteUrl`, `buildAttachmentRequest({siteUrl, storageId, password}) → {url, headers}`, `describeFetchFailure`, `successVerdict(...)`, plus the mirrored constants (`FETCH_COMMAND = "attachment-fetch"`, route prefix, auth scheme, max bytes). `cli.ts` gets a ~25-line `fetchAttachment()` wrapper that does I/O only.
- **Contract test** (`.agents/tools/workflow/lib/attachments.test.ts`): when `../../../../workflow-engine/convex/lib/attachments.ts` exists (it will in this repo; guarded with `existsSync` so a client-repo copy of `.agents` doesn't fail), import both modules and assert the command name, route prefix, auth scheme and byte limit are identical, and that the rendered block's command line for a sample attachment starts with `npx tsx .agents/tools/workflow/cli.ts attachment-fetch <id> --out `. This is the only cross-package edge and it is test-only; the CLI never imports Convex code at runtime.
- The runner spawns harnesses with `cwd: projectRoot` (`runner.ts:191`), so the relative invocation in the block is correct as rendered.

### 5. Discard + cascade (AC5)

- `chatMessages.discardAttachment({ password, storageId })` → `try { await ctx.storage.delete(storageId); return { deleted: true } } catch { return { deleted: false } }`. Used by the UI when a **pending** item is removed. Accepted trade (single user, password-gated): it deletes whatever storageId it is given; there is no referential check against sent messages.
- `chatThreads.remove` step 3: for each message, `for (const a of message.attachments ?? []) { try { await ctx.storage.delete(a.storageId) } catch { /* already gone */ } }` before `ctx.db.delete(message._id)`. A missing blob must never abort thread deletion.

### 6. UI (AC6, AC7, AC8)

**Ownership decision** — uploads are owned by `ChatPanel`, not `ChatInput`:

| Option | Thread-switch mid-upload | Draft persistence | Verdict |
|---|---|---|---|
| `ChatInput` local state + upload | Upload completes after the input re-mounted for another thread → result lands in the wrong thread or is lost | Would need a second persistence path | Rejected |
| `ChatPanel` owns `{text, attachments}` per thread in the existing `draftsRef` map | Completion callback is keyed by the `threadId` captured at start → always lands in the right draft | Extends the existing draft mechanism in place | **Selected** |

Draft model (ChatPanel): `draftsRef: Map<threadId, { text: string, attachments: PendingAttachment[] }>` where

```js
PendingAttachment = { id /* client uuid */, filename, size, mime, storageId /* null while uploading */, status: 'uploading' | 'ready' | 'error', error?: string, oversize: boolean }
```

- **Persistence (AC7):** text stays under the existing key `workflow-engine:draft:<threadId>` (unchanged format — old drafts still load). Attachments persist under a new key `workflow-engine:draft-attachments:<threadId>` as a JSON array of `{filename, storageId, size, mime}` for `ready` items only (in-flight/error items are not persisted). Restored on thread switch with `status: 'ready'`, recomputing `oversize`. `clearDraft` removes both keys. Same 500 ms debounce for the text; attachments write immediately on each change (rare events).
- **Upload flow:** `addFilesToDraft(threadId, FileList|File[])` → for each file, push an `uploading` item, then `await generateUploadUrl()` (`useMutation(api.files.generateUploadUrl)` — password auto-injected) → `fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': mime }, body: file, signal })` → `{ storageId }` → mark `ready`. Errors mark `error` with a short message (chip shows it; remove still works). An `AbortController` per item lives in a ref map so remove-while-uploading aborts the POST.
- **Remove:** abort if uploading; if `ready`, call `discardAttachment({storageId})` (fire-and-forget, log on failure); drop the item; persist.
- **Send / send-to-fork:** `canSend = !disabled && !anyUploading && (text.trim().length > 0 || readyAttachments.length > 0)`. `addMessage({ threadId, role: 'user', content, attachments })` / `forkThread({ sourceThreadId, content, attachments })` — `attachments` passed only when non-empty, mapped to `{filename, storageId, size, mime}`. On success clear both parts of the draft; on fork failure restore both (existing restore path extended).
- **ChatInput surface** (all Quake styling, `borderRadius: 0`, Q palette vars, shared `QIcon`):
  - "+" button (`QIcon add`) left of the textarea, opens a hidden `<input type="file" multiple>`; keyboard-focusable with visible focus ring; `title`/`aria-label` "Attach files".
  - Drag-and-drop on the whole input container: `dragenter/dragover` (preventDefault, set `dropActive`), `dragleave` (counter-based to avoid flicker), `drop` → `onAddFiles(e.dataTransfer.files)`. Drop state = copper outline + "Drop files to attach" overlay text; no layout shift.
  - Clipboard paste on the textarea: `onPaste` → items with `kind === 'file'` → `onAddFiles([...])` and `preventDefault` only when a file was taken (text paste unaffected). Pasted images with no name get `pasted-<ISO timestamp>.<ext from mime>`.
  - Pending list above the textarea, one row per item: filename (truncated, `title` = full name), `formatBytes(size)`, state text (`uploading…` with the existing `torchFlicker` treatment; `error: <msg>`), a remove button (`QIcon close`, `aria-label` "Remove <filename>"), and when `oversize` a `QIcon warning` in lava with text "over 20 MB — the agent can't fetch this". Nothing is blocked by the warning (AC9).
  - Send button disabled while any item is uploading; its `title` says why ("Waiting for uploads…") — Design Bar: disabled actions have a visible reason.
- **MessageBubble (AC8):** when `message.attachments?.length`, render a chip row under the markdown: each chip is a `<button>` (never an `<a>`; no URL in the DOM) with filename + size. Click → `fetchAttachmentBlob({ siteUrl, password, storageId })` → `URL.createObjectURL` → `window.open(blobUrl, '_blank')`. Image attachments (`mime.startsWith('image/')`) additionally render `<img src={blobUrl} alt={filename}>` (max-height ~240 px, `objectFit: contain`, `borderRadius: 0`), fetched through the same gated route on mount; the object URL is cached in a module-level `Map<storageId, Promise<string>>` so re-renders and re-mounts do not refetch. Failure renders a small lava-coloured "unavailable" chip state. `siteUrl` derives from `useConvex().url`; password from `usePassword()` — both providers wrap `ChatPanel` already (`LoginGate.js`).
- `attachmentUtils.js` (pure, no React): `deriveSiteUrl`, `attachmentUrl(siteUrl, storageId, filename)`, `authHeaders(password)`, `isOversize(size)`, `isImageMime(mime)`, `formatBytes`, `serializeDraftAttachments` / `parseDraftAttachments`, and the mirrored constants. Cold-tested from `workflow-engine/ui/test/attachmentUtils.test.ts` (outside the served tree; `check-deploy-shape.mjs` still syntax-checks the `.js` helper).

### 7. Backward-compatibility matrix

| Old component × new component | Effect |
|---|---|
| Old UI → new backend | Sends no `attachments`; `add`/`fork`/`trigger` behave identically (renderer is identity on undefined) |
| New UI → old backend (before the user deploys) | `add` would reject the unknown `attachments` arg. The UI only passes the arg when non-empty, so plain messages keep working; a message *with* attachments fails loudly in the console until deploy. Accepted: the user deploys UI+backend together (mental model: "UI and Convex deploy atomically"). |
| Old runner → new backend | Reads `latestUserMessage` as before; the block is just more text |
| CLI `chat-send`, Android `ReplyMarshaler` | Unchanged; never pass attachments |
| Existing `chatMessages` rows | No field → UI renders no chips |
| Old CLI (a chat job started before the edit) | Unaffected; command set only grew |

## Dependency Map

```
WP-1 Backend contract + lib + route + gate widening        ──┐
   (convex/lib/attachments.ts is the contract source)        ├─► WP-4 Review (single job, whole diff)
WP-2 Toolkit CLI command (mirrors constants; contract test) ──┤        │
WP-3 UI (mirrors constants; pure helper + components)       ──┘        └─► WP-5 Docs
```

- WP-1, WP-2, WP-3 share **no files**. Their only coupling is the contract table in §3/§4 (command name, route prefix, auth scheme, byte limit, block format), which this spec pins and the WP-2 contract test enforces against WP-1's module. They can run in parallel in one job group. If run in parallel, WP-2 must write its contract test to **skip** when the Convex lib file is absent (it will be present unless WP-1 hasn't landed yet — the test then passes trivially and turns real once WP-1 lands; review runs it for real).
- WP-4 (review) depends on all three. WP-5 (document) depends on WP-4.
- Validate gate widening (in WP-1) makes WP-2/WP-3 tests count; if WP-3 lands first, its `ui/test` glob must be added by WP-3 itself (a glob that matches nothing fails the shell-expanded command).

## Work Package Breakdown

Each WP is TDD: tests first (red), minimal code (green), refactor, then `npx tsx .agents/tools/validate/cli.ts` → `ok: true`. Vertical-slice focus is the **cold contract**, since no UAT is possible in this chain: each WP must leave the *next* consumer able to trust the contract without running anything live.

### WP-1 — Backend: schema, contract lib, block rendering, discard/cascade, HTTP route, gate widening

Files: `workflow-engine/convex/schema.ts`, `convex/lib/attachments.ts` (new), `convex/lib/attachments.test.ts` (new), `convex/chatMessages.ts`, `convex/chatJobs.ts`, `convex/chatThreads.ts`, `convex/http.ts` (new), `.agents/tools/validate/config.json`.

Steps:
1. Widen the validate `test` gate to include **all four** globs in one edit: `npx tsx --test .agents/tools/validate/*.test.ts .agents/tools/workflow/lib/*.test.ts workflow-engine/convex/lib/*.test.ts workflow-engine/ui/test/*.test.ts` (the first three are currently green; `tsx --test` ignores a glob that matches nothing yet, so adding `ui/test/*` before those files exist is safe). **WP-1 is the sole editor of `config.json`** — WP-3 does not touch it (see R-1 amendment A1). Mirror in `config.example.json` only if it lists repo-specific gates (it does not — leave it).
2. Red: `convex/lib/attachments.test.ts` (node:test, like `groupTransition.test.ts`) covering the cases in the Test Plan.
3. Green: `convex/lib/attachments.ts` per §2/§3.
4. Schema field; `chatMessages.add` optional arg + conditional spread; `discardAttachment`.
5. `chatJobs.trigger`: `latestUserMessage: renderAttachmentsBlock(triggerMessage.content, triggerMessage.attachments)`. `chatThreads.fork`: optional `attachments` arg, stored on the inserted message, rendered into `latestUserMessage`.
6. `chatThreads.remove` cascade per §5.
7. `convex/http.ts` per §3 (default export `httpRouter`; GET + OPTIONS on `pathPrefix: "/attachments/"`). Cite the why-layer at the route and at the renderer using the repo's existing form (the mental model carries no `{#mm-…}` anchors): `// @see docs/project/spec/mental-model.md — UI Mental Model / Message Attachments` (privacy decision at the route; block-in-message decision at the renderer). Never edit `mental-model.md`.
8. Validate → `ok: true` (ts:check now covers `http.ts`).

Success criteria: AC1, AC2, AC3, AC5, AC9 hold by inspection of source + cold tests; `ctx.storage.getUrl` is not referenced outside `files.ts`; no existing function signature changed; validate green with the widened gate; no deploy performed.

### WP-2 — Toolkit CLI: `attachment-fetch`

Files: `.agents/tools/workflow/lib/attachments.ts` (new), `.agents/tools/workflow/lib/attachments.test.ts` (new), `.agents/tools/workflow/cli.ts` (one atomic edit), `.agents/tools/workflow/config.example.json` (add optional `convexSiteUrl` with a comment-equivalent placeholder only if the file tolerates it — it is plain JSON; prefer documenting the key in README instead and leave the example untouched).

Steps:
1. Red: `lib/attachments.test.ts` (Test Plan) including the guarded contract test.
2. Green: `lib/attachments.ts` (pure).
3. **Atomic** `cli.ts` edit: import, `COMMAND_FLAGS["attachment-fetch"]`, `fetchAttachment()` I/O wrapper, `case "attachment-fetch"`, header comment + `USAGE` line. Immediately run `npx tsx .agents/tools/workflow/cli.ts help` and confirm the new line prints (this is a cold invocation — it loads `config.json` and constructs a client but performs no network call for `help`).
4. Validate → `ok: true`.

Success criteria: AC4; `help` documents the command; one JSON verdict per call on the documented streams; no existing command or flag changed; the CLI never imports `workflow-engine/` at runtime; contract test asserts parity with WP-1's constants and block format.

### WP-3 — UI: input affordances, draft persistence, bubble chips + previews

Files: `workflow-engine/ui/js/api.js`, `js/components/chat/attachmentUtils.js` (new), `workflow-engine/ui/test/attachmentUtils.test.ts` (new), `js/components/chat/ChatPanel.js`, `ChatView.js`, `ChatInput.js`, `MessageBubble.js`, `styles.css`. **WP-3 does NOT edit `.agents/tools/validate/config.json`** — WP-1 already added the `workflow-engine/ui/test/*.test.ts` glob (R-1 amendment A1). This makes WP-1/WP-2/WP-3 file sets fully disjoint.

Steps:
1. Red: `ui/test/attachmentUtils.test.ts` (Test Plan).
2. Green: `attachmentUtils.js`.
3. `api.js` refs; `ChatPanel` draft model + upload/remove/send/fork changes (§6); `ChatView` prop pass-through; `ChatInput` affordances; `MessageBubble` chips/preview; CSS. `node --check` after every file edit.
4. Validate → `ok: true` (`check-deploy-shape` syntax-checks every `.js`).

Success criteria: AC6, AC7, AC8, AC9 by source inspection + helper tests: no `<a href>` or `<img src>` ever receives a Convex storage or route URL (only `blob:` URLs); password travels only in the `Authorization` header; the "+"/close/warning icons are `QIcon`; every new control has hover + focus + disabled states with a visible disabled reason; zero `border-radius`; drafts round-trip both text and attachments across thread switches (helper-level serialisation tested; component wiring reviewed).

### WP-4 — Review (single job, whole branch diff)

Checklist beyond AOP.ASSESS: contract parity across the three mirrors (grep the four constants); `getUrl` confined to `files.ts`; no query string carries the password; `remove` cascade cannot abort on a missing blob; `cli.ts` diff is additive (existing `case`s byte-identical); the `**User says:**` path is the only place the block reaches the prompt (no template edits); no `uat` job, deploy, or restart happened (check assignment job list + git log); validate `ok: true` on the reviewer's own run.

### WP-5 — Document

Files listed in the Overview docs row. Toolkit README gains the command and the optional `convexSiteUrl` key; UI spec's "Chat and Assignment Flow" gains the attachment step and item 7 gains the second localStorage key; `password-wall.md` gains the HTTP route as a fifth entry point in its trust table (Untrusted, bearer password); `workflow-engine-spec.md` `chatMessages` dictionary gains the field and the function table gains `http.ts`. `templates/product-owner.md` is **not** edited (the block is self-describing) unless review finds an agent could not act on it.

## Test Plan (cold only — runs inside the validate `test` gate)

`workflow-engine/convex/lib/attachments.test.ts`
- `renderAttachmentsBlock(content, undefined | [])` returns `content` unchanged (identity, including empty string and trailing whitespace).
- One attachment: prose first, separator, header count `(1)`, filename/mime/size line, storageId, exact command line with the suggested `--out`.
- Two attachments with the same filename → `--out` paths de-duplicated (`-2`).
- Oversize attachment → warning line present, command still present.
- Empty prose + attachments → block only, no leading blank lines.
- `safeFilename`: strips `/`, `\`, control chars; collapses spaces; truncates to 120; falls back to `attachment`.
- `formatBytes`: 0 B, 1023 B, 1.0 KB, 184.2 KB, 1.4 MB, 20.0 MB.
- `parseAttachmentPath`: `/attachments/kg2abc` → id; `/attachments/` → null; `/attachments/kg2abc/extra` → null.
- `bearerFrom`: `Bearer x` → `x`; case-insensitive scheme; missing/empty/other scheme → null.
- `contentDispositionFor("Q3 budget €.xlsx")` → `inline; filename*=UTF-8''Q3%20budget%20%E2%82%AC.xlsx`.
- `attachmentResponseHeaders` includes `Cache-Control: private, no-store`, nosniff, CORS allow-origin, expose headers; falls back to `application/octet-stream`.
- `ATTACHMENT_MAX_BYTES === 20 * 1024 * 1024`.

`.agents/tools/workflow/lib/attachments.test.ts`
- `deriveSiteUrl`: `https://utmost-vulture-618.convex.cloud` and with trailing slash → `https://utmost-vulture-618.convex.site`; `http://localhost:3210` → null; `https://x.convex.site` → returned as-is.
- `buildAttachmentRequest` → URL `<site>/attachments/<id>`, header `Authorization: Bearer <pw>`, and the password does not appear in the URL.
- `describeFetchFailure` for 401/404/413/500 and network error → the exact messages in §4.
- `successVerdict` shape `{ ok: true, storageId, out, bytes, contentType }`.
- Contract test (guarded by `existsSync`): constants equal across `convex/lib/attachments.ts` and this module; rendered block command line starts with `npx tsx .agents/tools/workflow/cli.ts attachment-fetch <id> --out `.

`workflow-engine/ui/test/attachmentUtils.test.ts`
- `deriveSiteUrl` parity cases; `attachmentUrl` encodes the filename param and never includes a password; `authHeaders` shape; `isOversize` boundary at exactly 20 MiB (not oversize) and +1 byte (oversize); `isImageMime`; `formatBytes` parity; `serializeDraftAttachments` keeps only `ready` items and only the four persisted fields; `parseDraftAttachments` tolerates missing key, malformed JSON, and non-array values (returns `[]`) and restores `status: 'ready'` + recomputed `oversize`; constants parity with the Convex lib (guarded import).

Explicitly **not** tested cold (needs a runtime the constraint forbids): `http.ts` end-to-end, `ctx.storage.*` behaviour, React component behaviour, drag/paste browser events, CORS preflight. These are the user's live checks after deploy (listed in the hand-off section below for the user, not as jobs).

## Not in this assignment

- **No `uat` jobs, no browsertools, no live exercise** of the UI, the route, or the CLI against the deployment.
- **No deploy**: no `convex deploy`, no `vercel build`, no Vercel trigger. No `convex dev`.
- **No runner restart, no harness kill, no edits to `runner.ts` / `harness-executor.ts` / `prompts.ts`** (none are needed — verified above).
- No server-side count/size enforcement, no chunked or multipart transport for >20 MB files, no thumbnails/transcoding, no virus scanning.
- No agent→user attachments (assistant messages never carry the field in this phase; the schema field is technically role-agnostic but no producer exists).
- No `chat-send --attach` on the CLI, no Android-shell attachment support.
- No prompt-template edits; no data migration/backfill (none required).
- No change to `files.getDownloadUrl` / the APK hand-off path.
- No copying of scrollback on fork (unchanged decision).

## User hand-off (post-review live checks — performed by the user, not by any job)

After `convex deploy` + Vercel deploy: (1) drop, paste and pick files; watch the pending list, remove one, confirm no orphan in the Convex storage dashboard; (2) send with an image and a PDF, see chips + inline preview, click a chip; (3) in the agent's reply confirm it ran `attachment-fetch` and described the screenshot; (4) `curl -i https://<slug>.convex.site/attachments/<id>` → 401, then with `-H "Authorization: Bearer <pw>"` → 200 with `Content-Disposition`; (5) delete a thread with attachments and confirm the blobs are gone. The runner needs **no** restart for this phase.

## Ambiguities / Decisions Needed (defaults chosen so implementation is not blocked)

1. **Attachments-only messages** (no prose): allowed (`content: ""`), matching every modern chat. Reverse by making `canSend` require text.
2. **Auth header**: `Authorization: Bearer <password>` (see §3 rationale). Reverse by renaming one constant in the three mirrors.
3. **`?filename=` on the route**: accepted as a non-secret display hint for `Content-Disposition`; the route never needs a DB lookup and pending (unsent) blobs have no message to look up. The password stays header-only.
4. **`discardAttachment` scope**: deletes any storageId given the password; no referential check. Single-user trade recorded in code comment.
5. **Inline previews** for all `image/*` mimes (SVG via `<img>` cannot execute script). Non-image files are chips only.
6. **Suggested `--out` path** `/tmp/attachments/<safe filename>`; the agent may choose another path.
7. **Draft-restored attachment whose blob was deleted elsewhere**: sends a dangling storageId; fetch yields 404 with an actionable verdict. Accepted.
8. **Parallel vs single implement job**: see below; the PM may collapse to one job without changing the spec.

## Assignment-Level Success Criteria

1. `chatMessages.attachments` optional field exists; all existing callers and rows unaffected (AC1).
2. `chatMessages.add` and `chatThreads.fork` accept optional attachments; `chatJobs.trigger` and `chatThreads.fork` render the block (prose first) only when attachments exist; each line carries filename, storageId, exact fetch command (AC2).
3. `convex/http.ts` serves a blob by storageId, bearer password in a header only, 401 on missing/mismatch, `Content-Type` + `Content-Disposition` with the original filename, 413 above 20 MiB (AC3).
4. `attachment-fetch <storageId> --out <path>` in the CLI, `.convex.site` derived from `.convex.cloud`, single actionable verdict, documented in `help` (AC4).
5. `discardAttachment` mutation exists; thread removal deletes attachment blobs and never aborts on a missing blob (AC5).
6. Chat input has "+" (QIcon `add`), drag-drop with visible drop state, clipboard image paste, pending list with uploading state, remove, and >20 MB warning; uploads use `files.generateUploadUrl` (AC6).
7. Pending attachments persist and restore with the per-thread draft (AC7).
8. Bubble chips + inline image previews fetched through the gated route with the password in a header; no storage or route URL in the DOM (AC8).
9. No count cap, no total-size cap, no server-side size enforcement (AC9).
10. Validate CLI `ok: true` with the widened `test` gate; cold tests cover the block renderer and the CLI's URL derivation + verdict shape (AC10).
11. Docs updated per WP-5; toolkit help updated; no template edits (AC11).
12. Zero `uat` jobs, zero deploys, zero runner restarts in this assignment's history (AC12).

## R-1 Review Amendments (folded in by NavigatorPM, 2026-09-19)

Three reviewers assessed this plan and returned **approve-with-required-changes**. The plan's central architecture (server-side block rendering; `runner.ts`/`prompts.ts` untouched; `getUrl` confined to `files.ts`; ChatPanel-owned uploads keyed by captured `threadId`; cold-only contract tests) was **verified correct against source by all three** — no rework. The following required changes are folded in; every remaining reviewer suggestion is either already covered above or was assessed and declined below.

**A1 — `config.json` single-owner (was: both WP-1 & WP-3 edited it; Med).** WP-1 performs the full four-glob widening; WP-3 does not touch `config.json`. Fixed inline at WP-1 step 1 and the WP-3 files list above. Since this assignment runs as a **single implement job** (see Decision below), the file sets need not be disjoint for parallelism — but single-ownership of the gate file is kept so the gate can never be silently narrowed by a lost update.

**A2 — `http.ts` auth is a thin adapter over a pure, cold-tested gate (was: message-string matching, untested; Med, privacy gate).** Add `isAuthorized(bearer: string | null, expected: string | undefined): boolean` to `convex/lib/attachments.ts` (constant-time-ish compare of the bearer token against `process.env.ADMIN_PASSWORD`; `expected` undefined ⇒ server-misconfigured, treated as *not* authorized) and unit-test it. `http.ts` calls `bearerFrom()` → `isAuthorized()` and branches: not authorized + no `ADMIN_PASSWORD` → 500; not authorized → 401; else serve. **Any unmapped/thrown error path must default to refuse (401/500) — never fall through to a 2xx.** Do not rely on `requirePassword`'s exact exception strings for the success/failure decision.

**A3 — thread-deletion cleans up *pending* (unsent) blobs too (was: only sent-message cascade; Med, orphan gap).** The backend `remove` cascade (§5) only sees sent-message attachments. The UI thread-delete flow (`ChatPanel` delete handler) must, before calling `removeThread`: abort any in-flight uploads for that thread, `discardAttachment` every `ready` pending blob in that thread's draft, and clear **both** draft keys (`draft:` and `draft-attachments:`). Fire-and-forget discards, logged on failure — deletion must never block on a storage error.

**A4 — attachment click uses a popup-blocker-safe open (was: `window.open` after `await fetch`; Med, UX).** The user-activation token expires across the `await`, so `window.open(blobUrl)` post-fetch is blocked in modern browsers. In `MessageBubble`, either open `window.open('about:blank','_blank')` **synchronously on click** and set `tab.location.href = blobUrl` on resolve (null-guard if the browser still blocked it — fall back to an ephemeral `<a download>` click), or drive the whole thing through an ephemeral `<a download="<filename>">` anchor. Inline image previews (fetched on mount, not on click) are unaffected.

**A5 — attachments-only send actually enables the submit control (Low, correctness).** `ChatInput`'s existing submit gate `if (trimmedMessage && …)` blocks empty-text sends today. Widen it (and give `ChatInput` awareness of ready-attachment count) so the ChatPanel-level `canSend = (text.trim() || readyAttachments.length) && !anyUploading` is honored end-to-end — otherwise Decision #1 (attachments-only messages) is dead on arrival.

**A6 — `safeFilename` hardening (Low, path safety).** Beyond stripping separators/control chars: strip leading dots, replace any `..` run, **preserve the extension when truncating to 120** (`base.slice(0, 120 - ext.length) + ext`), and fall back to `attachment` when the result is empty. Covered by the existing `safeFilename` test bullet — extend it with `..`, `.bashrc`, and long-name-with-extension cases.

**A7 — CLI `attachment-fetch` wraps filesystem I/O (Low).** Wrap `mkdirSync`/`writeFileSync` in the `fetchAttachment()` wrapper in try/catch and emit the standard single-channel `error("Write failed: " + err.message)` verdict (`EACCES`/`EISDIR`/`ENOSPC` must not throw a raw stack). One verdict per call still holds.

**A8 — `Content-Disposition` carries an ASCII fallback (Low, AC3/RFC 6266).** Emit both `filename="<safe-ascii>"` and `filename*=UTF-8''<encoded>` in `contentDispositionFor()`. Extend its test to assert both parameters are present. This also firms AC3's "original filename": the UI passes `?filename=` (it knows the name locally) and the CLI writes to the agent-chosen `--out`, so the *original filename* requirement is met on the path that reads the header (the browser) without any DB lookup — no registry needed (see Declined D-b).

**A9 — bubble renders no empty markdown container (Low, cosmetic).** In `MessageBubble`, render the `markdown-content` block only when `message.content?.trim().length > 0`, so an attachments-only message shows chips without an empty leading block.

**Declined / accepted-as-is (assessed, not folded in):**
- **D-a — server-side attachment registry to lock down `files.getDownloadUrl` (review B, High).** Declined — see assignment Decision D1. Chat privacy is delivered by code-path discipline + the existing password-on-all-functions gate; a storageId-discriminating registry is the "complex auth" the mental-model Security Model rejects, and `files.getDownloadUrl` is explicitly out of scope. The feature never calls `getUrl`/`getDownloadUrl`; only the bearer-gated route serves blobs.
- **D-b — filename via registry lookup (review B, High).** Declined for the same reason; the `?filename=` hint + local UI knowledge + `--out` fully satisfy AC3 (A8). `?filename` as a display hint in the query string is accepted under the single-user model (review A rated it Low); the password stays header-only, never in the URL.
- **D-c — 20 MiB zero-headroom boundary (review A, Low).** Accepted as-is: the exact-boundary case is the user's post-deploy `curl` check (§ hand-off #4). Keep `ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024`; do not invent a margin the mental model didn't ask for.
- **localStorage vs sessionStorage (review B, Low):** implementation already uses localStorage (`LoginGate.js`); WP-5 docs must not inherit stale sessionStorage language.

## Recommended Job Sequence

1. **Implement group (parallel, 2 jobs)** — Job A: WP-1 + WP-2 (backend + CLI; the two ends of the contract, proven by the contract test in one hand). Job B: WP-3 (UI; largest surface, no file overlap with A). Both cite this spec and the self-surgery rules. Fallback if the PM prefers a single writer on the shared tree: one implement job doing WP-1 → WP-2 → WP-3 in that order.
2. **Review (1 job)** over the whole branch diff with the WP-4 checklist; fix-forward via a second implement job only if review finds a blocking defect.
3. **Document (1 job)** — WP-5.
4. **Stop.** No UAT job. The assignment completes with reviewed, documented code on `main`; the user deploys and runs the hand-off checks.
