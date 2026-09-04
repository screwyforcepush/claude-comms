# Hands-Free Voice Loop — Android Shell (Spec)

Phase: `20-VoiceLoopAndroidShell`
Status: PLANNED — hardened in place after fan-out review A/B/C (2026-09-03): all reviewer-concurred High items closed with concrete prescriptions (D-cursor, D-dormancy, D11–D15); no architecture change.
Why-layer: `docs/project/spec/mental-model.md` § "Hands-Free Voice Loop (Mobile)" — read in full before implementing. All settled decisions (no FCM/Firebase/web-push, foreground-service Convex listener, MessagingStyle+RemoteInput as the entire point, reply never marks read, feed-only background subscription, "app killed = reopen it" failure posture) live there and in the north star and are **not** relitigated here.
Engine contract consumed (read-only): `docs/project/phases/19-HandsFreeVoiceLoop/engine-spec.md`, `workflow-engine/convex/notifications.ts`.

## Toolchain Feasibility Decision (settled first, empirically)

**VERDICT: FEASIBLE — an APK builds inside this container. The signed-or-debug APK is a validate-able deliverable of the implement job.**

Proven by smoke test (2026-09-03): a minimal AGP `assembleDebug` produced `app-debug.apk` in-container. The chain and why it works:

- Host is **linux/aarch64** (Docker Desktop, linuxkit kernel). Android's native build tools (aapt2 etc.) ship **x86-64-only** Linux binaries — normally a hard blocker on arm64.
- **Docker Desktop's Rosetta binfmt handler is present** in this container. The only missing piece was the x86-64 userland: after `sudo dpkg --add-architecture amd64 && apt-get install libc6:amd64 libstdc++6:amd64 zlib1g:amd64`, Google's stock x86-64 `aapt2` executes cleanly under Rosetta (`aapt2 version` → exit 0).
- Everything else is JVM (arm64-native): Gradle, AGP, d8/r8, apksigner. JDK via apt/tarball. Network to `dl.google.com`, `services.gradle.org`, Maven Central, npm is open; disk is ample (1.4 TB free); passwordless sudo works.
- Smoke test exact chain: OpenJDK 17 (apt) + Gradle 8.10.2 + AGP 8.7.2 + cmdline-tools 11076708 + `platforms;android-35` + `build-tools;35.0.0/34.0.0` → APK. **Caveat (reviewer-flagged): that is NOT the pinned Capacitor-8 stack.** Capacitor 8 raises it to JDK 21 / AGP 8.13.0 / Gradle wrapper 8.14.3 / SDK 36 — same Rosetta path, so feasibility holds, but the exact pinned stack is unexercised. Therefore **WP-A smoke-builds (`assembleDebug`) the freshly-scaffolded Capacitor 8.5.1 project on the pinned stack BEFORE any service code is written (WP-A step ④)** — if that fails, stop and surface it; do not build service code on an unproven toolchain. (JDK 21 is not in bookworm apt; use an Adoptium Temurin 21 **aarch64** tarball.)
- **Node 22 is required and NOT present** (verified in-container: `node -v` → v20.20.0; `@capacitor/cli@8.5.1` declares `engines.node >=22.0.0`). `setup-toolchain.sh` installs a Node 22 **aarch64** tarball to `~/.android-toolchain/node-22` and all android-shell npm/npx commands run with it prepended to `PATH` (e.g. via a `with-node22.sh` wrapper or documented `export PATH=~/.android-toolchain/node-22/bin:$PATH` scoped to the android-shell shell session). **The container's default Node 20 is untouched** — repo validate gates keep running on it; nothing global (no nvm default switch, no /usr/local/bin symlink changes).
- No emulator anywhere (build-only, per north star). Device verification is exclusively the user's hands.

Consequence: **the fallback deliverable shape (buildable project + instructions only) is NOT taken.** Build instructions are still delivered in the hand-off note (the user may want to rebuild on their own machine), but the assignment terminates with a real APK.

**WP-A must ship `workflow-engine/android-shell/scripts/setup-toolchain.sh`** — idempotent, re-runs safely in a fresh container: amd64 multiarch libs, Temurin JDK 21 aarch64 tarball → `~/.android-toolchain/jdk-21`, **Node 22 aarch64 tarball → `~/.android-toolchain/node-22`** (PATH-scoped to android-shell commands only — validate's Node behavior must not change), cmdline-tools → `~/.android-toolchain/sdk`, `sdkmanager "platforms;android-36" "build-tools;36.0.0"`, license acceptance. SDK lives under `~` (not `/tmp`) so it survives container idles. The script is also the authoritative "build it yourself" documentation for the user.

## Purpose

The engine half is live and user-verified: renditions land in the prod `notifications` table (Phase 19). This phase builds the consumer — a thin Capacitor Android app whose entire reason to exist is native notifications. It subscribes to `notifications:feed` from a foreground service, posts each row as a MessagingStyle notification the Pixel's assistant can read aloud, carries a RemoteInput inline reply that posts the dictated text back to the thread exactly as a typed web-UI message would, and deep-links a tap to that thread in the wrapped web UI. Deliverable: a sideloadable APK.

## Overview

One new top-level project directory, one one-line UI change, zero engine changes:

| Surface | New file(s) / change | Notes |
|---|---|---|
| Capacitor project | `workflow-engine/android-shell/` (own `package.json`, `capacitor.config.ts`, `android/`) | Self-contained; no pnpm workspace exists at root, so no hoisting interference |
| Native service | `android/app/src/main/java/.../FeedListenerService.kt` | FGS `specialUse`, one Convex subscription |
| App singleton | `ShellApplication.kt` (registered as `android:name` in manifest) | Holds the single `ConvexClient` instance (`ConvexHolder`) shared by `FeedListenerService` and `ReplyReceiver` |
| Notifications | `NotificationPoster.kt`, `ReplyReceiver.kt` | MessagingStyle + RemoteInput |
| Pure logic (unit-tested) | `FeedProtocol.kt`, `PayloadMapper.kt`, `ReplyMarshaler.kt` | JVM-only, no Android deps |
| Config screen | `ConfigActivity.kt` + SharedPreferences | convexUrl, adminPassword, uiUrl |
| Web UI (THE one permitted additive change) | `workflow-engine/ui/js/components/chat/ChatPanel.js` — initialize `selectedThreadId` from `?thread=` URL param | ~3 lines; additive; validate-green |
| Toolchain | `android-shell/scripts/setup-toolchain.sh` | See feasibility section |

**Pinned versions** (Decision D2): `@capacitor/cli` + `@capacitor/android` + `@capacitor/core` **8.5.1** (current major; AGP 8.13.0, compileSdk/targetSdk 36, Java 21, scaffold's own Gradle wrapper 8.14.3), `minSdk 26`, `dev.convex:android-convexmobile:0.8.0@aar` (`isTransitive = true`) + `org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3` (runtime paired with the Kotlin 2.0.x plugin below; supersedes the earlier 1.6.3 pin), `androidx.core:core-ktx` (NotificationCompat), `androidx.webkit:webkit` (document-start script injection). Temurin JDK 21 aarch64. **Node 22** (tarball, PATH-scoped — see toolchain section).

**Kotlin Gradle plugins are NOT in the scaffold and MUST be added** (reviewer-verified: the Capacitor 8.5.1 template generates a pure-Java Gradle project — no Kotlin plugin anywhere). WP-A's scaffold step explicitly adds, pinned at **2.0.21**:
- `org.jetbrains.kotlin.android` (root `build.gradle` classpath / plugins block + `apply` in `app/build.gradle`)
- `org.jetbrains.kotlin.plugin.serialization` (same; required for `@Serializable` DTOs)

Without these the build fails on the first `.kt` file. The pinned-stack smoke build (WP-A step ④) runs after adding them, so the Kotlin 2.0.21 + AGP 8.13.0 + serialization-1.7.3 combination is empirically proven before any service code exists.

**Scaffold cleanup — strip Google-services/Firebase boilerplate (no-FCM guardrail, enforced mechanically).** The Capacitor Android template ships a `com.google.gms:google-services` classpath entry and a conditional `apply` block in `app/build.gradle` (reviewer-verified against the 8.5.1 template). Even inert, leaving it contradicts the hard "no FCM/Firebase/web-push anywhere" posture. WP-A's scaffold step removes the classpath line and the conditional-apply block, then asserts the tree is clean:

```
grep -riE "firebase|fcm|google-services|web-push|@capacitor/push" workflow-engine/android-shell/ --exclude-dir=node_modules --exclude-dir=build
```

must return zero hits (node_modules/build excluded — we don't control third-party package internals; the assertion covers everything we commit). This grep is a WP-A success criterion and a review checklist item.

External research performed (Perplexity + registry/Maven verification at initial planning; hardening pass verified Node/engine facts live in-container and leaned on three independent reviewers' decompile/doc verification of Capacitor `Bridge.java`, the Convex Kotlin client bytecode, and Android FGS/notification/RemoteInput docs — re-research was not repeated where all three converged with cited sources): Convex Kotlin client capabilities, Capacitor 8 toolchain requirements, Android 14/15/16 FGS + notification rules. Key findings baked into the design below.

## Architecture Design

### Service architecture decision (assignment item 3)

| Option | Purpose fit | Battery/feed-only guarantee | Maintainability | Verdict |
|---|---|---|---|---|
| **Native Kotlin FGS + official Convex Kotlin client** | Direct: Flow subscription, native notifications in the same process | Structural — the service's ConvexClient literally knows only one query | One small Kotlin file set; official client handles WS reconnect/backoff internally (Rust core via UniFFI) | **SELECTED** |
| Capacitor background-runner plugin (JS in background) | Poor: designed for short-lived periodic JS tasks, not a persistent socket | Weak — JS runtime lifecycle not ours to hold | Fights the plugin's model | Rejected |
| Headless webview kept alive for JS Convex client | Violates mental model (webview must go dormant; chatty UI subscriptions risk) | None — the whole UI bundle wakes up | Fragile | Rejected |

The Capacitor layer is deliberately thin: it provides the scaffold, `MainActivity`/webview, and config plumbing. The service, notifications, reply, and deep-link are plain Kotlin — no Capacitor plugin API needed for them.

### Component: FeedListenerService

- Foreground service, `android:foregroundServiceType="specialUse"` with `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` = "persistent Convex notification-feed listener". **Not `dataSync`** — dataSync has a 6-hour rolling limit on Android 15+; `specialUse` is exempt from that timeout and fine for a sideloaded single-user app (no Play review).
- Manifest permissions: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE`, `POST_NOTIFICATIONS` (runtime-requested on first launch), `INTERNET`.
- Started from `MainActivity` when config exists (launcher-foreground start — no background-start restriction applies). `START_STICKY`. No boot receiver (Decision D6 — "app killed = reopen it" is the accepted posture; a boot receiver is scope creep against a settled failure model).
- Persistent service notification on its own channel at `IMPORTANCE_MIN` ("Feed listener active") — quiet/minimized; the hand-off note documents how to silence the channel entirely in system settings.
- Holds **exactly one** Convex subscription: `client.subscribe<FeedResponse>("notifications:feed", mapOf("password" to pw, "cursor" to storedCursor, "limit" to 50.0))` collected in the service coroutine scope. API facts (reviewer-verified against `dev.convex:android-convexmobile:0.8.0` bytecode): `subscribe` is an `inline fun <reified T>` returning **`Flow<Result<T>>`** — emissions are unpacked via `result.onSuccess { ... }` / `result.getOrNull()`, and a `Result.failure` emission is logged, never treated as data. There is **no one-shot `query()` method** on `ConvexClient` — anywhere the spec needs a single page (fresh-install drain), the idiom is `client.subscribe<FeedResponse>(...).first().getOrThrow()`. **All numeric args are `Double`** (`limit` as `50.0`, cursor per the Double rule below) — Kotlin `Int`/`Long` serialize as Convex `$integer`/BigInt and fail `v.number()` arg validation. The client instance lives in `ShellApplication` (`ConvexHolder`), shared with `ReplyReceiver`. No other query is ever registered from native code (AC2). The Convex Kotlin client auto-reconnects with backoff (Rust core) — do **not** hand-roll a second reconnect loop. Add only: (a) a `ConnectivityManager` network callback that nudges resubscription on network regain, (b) supervisor-scope catch that logs and restarts collection after a delay (30 s cap) if the Flow terminally errors.
- Battery-optimization exemption is a **documented user step** (config screen offers a button firing `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`; hand-off note documents the manual Settings path as fallback). Not an engineering workaround — mental-model posture.

### Feed cursor + markDelivered discipline (assignment item 6)

Contract facts (verified against live `convex/notifications.ts` — consume, never modify): `feed {password, cursor: number|null, limit ≤200 default 50}` → `{rows asc by _creationTime, nextCursor}`; cursor value is the last row's `_creationTime` (NOT `createdAt`); empty page ⇒ `nextCursor: null`. `markDelivered {password, ids}` stamps `deliveredAt`. The feed filter is `q.gt("_creationTime", cursor)` — strictly-greater, so exact cursor preservation is what guarantees no dup/skip.

**Rule 0 — THE CURSOR IS A `Double` END-TO-END (Decision D-cursor, ratified; highest-risk detail in the phase).** Convex validates `cursor: v.union(v.number(), v.null())` = Float64 only. A Kotlin `Int`/`Long` arg serializes as `$integer`/BigInt and **fails argument validation → the subscription never returns → no notifications ever post after the first advance** — and this failure is invisible to JVM unit tests (no live Convex). `_creationTime` is also a *fractional* float timestamp: any integral truncation loses sub-ms precision and makes strictly-greater re-serve or skip rows. Mandated concretely:
- The `@Serializable` DTO declares `@SerialName("_creationTime") val creationTime: Double` and `val nextCursor: Double?` (and `createdAt: Double`). Never `Long`/`Int` for any Convex numeric field.
- The cursor **arg value** passed to `subscribe` is `Double?` (null on fresh install), `limit` is `50.0` (or `200.0` in drain).
- **Persistence:** `SharedPreferences` has no `putDouble`. Persist via `putLong(Double.doubleToRawLongBits(cursor))` / read via `Double.fromBits(getLong(...))` — bit-exact round-trip, no string parsing. (A decimal-String fallback is NOT used; one mechanism, no drift.)
- `FeedProtocolTest` asserts (a) the emitted cursor arg is typed `Double`, (b) a persist→load round-trip returns the bit-identical value for a fractional input like `1717430400123.4567`.

Shell discipline (all of this is pure logic in `FeedProtocol.kt`, unit-tested):

1. **Advance rule:** stored cursor advances **only when `nextCursor != null`**. An empty page never moves the cursor.
2. **Fresh install (no stored cursor):** drain-to-latest without posting — loop pages of `feed(cursor, 200.0)` until `nextCursor == null`, keeping the last non-null `nextCursor`; persist it; post nothing. Because `ConvexClient` has no one-shot `query()`, each page is fetched with `client.subscribe<FeedResponse>(...).first().getOrThrow()` (take the first emission, then the Flow collection ends and the subscription is released — still "one subscription at a time"). Clock-skew-proof (never synthesizes a cursor from device time). Empty table ⇒ cursor stays null, which is equivalent (nothing exists to replay). This initialization may run regardless of notification-permission state — it posts nothing by design.
3. **Permission gate (before any live processing):** Android 13+ ships `POST_NOTIFICATIONS` **denied by default on fresh install**. Before draining a live batch, check `areNotificationsEnabled()` + message-channel importance ≠ `IMPORTANCE_NONE`. If posting is impossible: enter a **config-blocked state** (service notification text flips to "notifications disabled — open the app", `MainActivity` surfaces the permission request) and **do NOT process, `markDelivered`, or cursor-advance live rows** — the subscription keeps them pending; nothing is silently dropped. Rows are acked only after they were actually made audible.
4. **Live batch processing order:** post native notifications (`NotificationPoster` returns per-row success/failure — a row counts as posted only on confirmed success) → `markDelivered(ids of successfully-posted + already-delivered rows)` → **only if `markDelivered` succeeds**, persist advanced cursor → resubscribe at new cursor. **`markDelivered` failure ⇒ do NOT advance or persist the cursor** — the reactive re-emission retries the same rows; re-posting is visually safe because per-thread notification identity (tag=threadId) replaces in place. A crash mid-sequence re-serves the same rows on restart; the next rule makes that safe.
5. **Replay guard:** a row with `deliveredAt != null` is **never posted again** (it was acked by a previous life) — the cursor still advances past it. Combined with per-thread notification identity (below), the protocol is effectively exactly-once for the user with at-least-once plumbing. `deliveredAt` also covers reinstall (rule 2 makes it mostly moot; it remains the belt-and-braces ack).
6. **Full page (`rows.length == limit`):** the resubscription at the advanced cursor immediately fires with the remainder — no special drain path needed in live mode. Note the reactive Flow re-emits the growing `q.gt(cursor)` result set on its own; correctness never depends on suppressing re-emits — it rests on (a) per-thread replace-in-place notification identity and (b) `deliveredAt`.
7. Cursor persisted in app-private `SharedPreferences` alongside config (raw-bits `Long` per Rule 0).

### Component: NotificationPoster (assignment item — MessagingStyle)

- Message channel at `IMPORTANCE_HIGH` (separate from the service channel).
- `NotificationCompat.MessagingStyle` modeled correctly (reviewer-verified against AndroidX docs): **the constructor `Person` is the LOCAL user** — `MessagingStyle(Person.Builder().setName("You").build())` — shown beside the user's own replies, NOT the conversation label. The conversation label comes from `setConversationTitle(row.title)` ("namespace · thread topic" — composed server-side, used verbatim). Each feed row is added via `addMessage(row.body, timestamp, senderPerson)` where `senderPerson` is the incoming sender (name it from `row.title` or a fixed "Assistant" `Person` — the incoming-message sender, never the local user). `row.body` is **verbatim** (pre-rendered listenable text ≤5000 chars — the shell never transforms, truncates, or re-wraps it; AC3).
- **Notification identity = `notify(tag = threadId, id = NOTIFICATION_ID_MESSAGE)`** with a constant int id — NOT `threadId.hashCode()` (string hashes collide). Multiple renditions in one thread append into one MessagingStyle conversation (recover via `MessagingStyle.extractMessagingStyleFromNotification` on the matching active notification found by tag; fall back to a fresh style if absent). Reposting the same row after a crash replaces in place (dedup for free).
- **`NotificationPoster.post(...)` returns success/failure** (permission check + `notify()` outcome). The feed loop acks only confirmed posts (Feed rule 3/4); a failed post leaves the row un-acked and the cursor unmoved.
- Tap: `contentIntent` = **Activity `PendingIntent` directly to `MainActivity`** (trampoline ban — no broadcast/service intermediary) with `threadId` extra, `FLAG_IMMUTABLE | FLAG_UPDATE_CURRENT`, distinct `requestCode` per thread.
- Inline reply: `RemoteInput` action ("Reply") whose `PendingIntent` targets `ReplyReceiver` — **`PendingIntent.getBroadcast(context, requestCode = perThread, intent, FLAG_MUTABLE | FLAG_UPDATE_CURRENT)`**. `FLAG_MUTABLE` is required (the OS must write the RemoteInput results bundle into the intent); per-thread identity comes from a distinct `requestCode` AND a thread-distinct intent (e.g. `intent.data = Uri.parse("thread://" + threadId)`), so concurrent conversations never share/overwrite a PendingIntent. (BroadcastReceiver is legal here — the trampoline ban only covers activity launches.)

### Reply path (assignment item 4 — traced, mirrored byte-for-byte)

Trace result — the live web send path is `ChatPanel.js:631` `handleSendMessage` (note: the "use chatActions.sendMessage" comment in `api.js:98` is stale — no `chatActions` module exists; `addMessage` + `triggerChatJob` **is** the real path):

1. `chatMessages:add` `{password, threadId, role: "user", content}` → returns the new message id (`convex/chatMessages.ts:34` — also bumps thread `updatedAt`/`latestMessageAt` server-side).
2. `chatJobs:trigger` `{password, threadId, triggerMessageId: <id from step 1>}` (`convex/chatJobs.ts:21`). **No `harness`/`model` args** — the server resolves them from namespace `harnessDefaults` exactly as for a typed message; guardian/session routing is all server-side. Returns `{jobId, mode}` (shell ignores it).

`ReplyReceiver` lifecycle (reviewer-required — a BroadcastReceiver's process may be killed the moment `onReceive` returns, so async network work needs explicit scaffolding):
1. `onReceive` runs on the main thread; it must call **`val pending = goAsync()`** before launching any coroutine, then launch the mutation work on an IO dispatcher, and call **`pending.finish()` in a `finally` block** — success, failure, or exception. No network on the main thread; no work after `finish()`.
2. The mutations go through **the same `ConvexClient` instance held by `ShellApplication` (`ConvexHolder`)** — the receiver never constructs its own client; `FeedListenerService` and `ReplyReceiver` share one connection without coupling their lifecycles.
3. Marshaling is built in pure `ReplyMarshaler.kt`; the receiver extracts the RemoteInput text and calls the two mutations in order.
4. **Always repost/update the notification** (required to clear Android's inline-reply spinner — the UI hangs on "Sending…" otherwise): on success, append the reply as a local-user (`Person("You")`) message; on mutation failure, repost with a "Reply failed — open the app" line appended; no retry machinery (v1 posture).

**`lastReadAt` is untouched by construction:** neither mutation touches it (verified in source); read-marking lives solely in `chatThreads:markRead`, which the native code never references. The unit test for `ReplyMarshaler` asserts the emitted mutation set is exactly `[chatMessages:add, chatJobs:trigger]` — nothing else (AC4).

### Deep link (assignment item 5 — needs the ONE permitted additive UI change)

Trace result: the web UI has **no URL-based thread addressing** — `selectedThreadId` is pure React state (`ChatPanel.js:338`), and `main.js` only uses `pushState(null, '')` for mobile back-button trapping. The minimal additive change is therefore genuinely needed:

**UI change (entire diff):** in `ChatPanel.js:338`, initialize state from the URL:
```js
const [selectedThreadId, setSelectedThreadId] = useState(() => {
  try { return new URLSearchParams(window.location.search).get('thread'); } catch { return null; }
});
```
Why this is sufficient: the auto-select effect (`ChatPanel.js:537`) only fires when `selectedThreadId` is null, so the param wins; the FIX-5 effect (`ChatPanel.js:544`) gracefully falls back to the first thread if the id is stale/invalid; on mobile the chat view is the primary surface (thread list is a drawer), so the deep-linked conversation renders directly. Additive, zero behavior change when the param is absent, invisible to all four validate gates except the deploy-shape syntax check (which it passes trivially).

**Native side:** `MainActivity` (`launchMode="singleTask"`) reads the `threadId` extra in `onCreate`/`onNewIntent` and loads the deep-link URL built with **`Uri.parse(uiUrl).buildUpon().appendQueryParameter("thread", threadId).build().toString()`** — never string concatenation (a configured base URL with an existing query/fragment or trailing slash would otherwise produce a broken URL, and the param value gets encoded for free). Normalize the configured base URL once at config-save time (trim trailing `/`, require scheme). Second tap while the app is open = full page reload with the new param — deliberate v1 simplicity (Decision D5); per-thread drafts already survive reloads via the UI's localStorage draft persistence.

Note on read-marking: opening the thread in the UI fires the UI's own `markRead` on selection — that is existing, correct behavior (the user is actually looking at the real message). The prohibition is only that **reply and rendition-hearing** never mark read, which holds.

### Config screen + webview (assignment items 2, 7)

- `capacitor.config.ts`: `server.url` is not used (it's static); instead `MainActivity` loads the **deployed web UI URL from config** at runtime. Bundled-assets option rejected (Decision D3): pointing at the deployed URL means UI updates never require an APK rebuild, and deep-linking is a plain query param on that URL — no Capacitor deep-link machinery needed at all.
- First-run: if prefs are empty, `MainActivity` routes to `ConfigActivity` — three fields: **Convex URL**, **password**, **web UI URL** (the deployed UI's URL is not recorded in-repo, so it's a runtime config field, pre-fillable placeholder; Decision D4 — **resolved by PM**: stays a config field per D3, not baked at build time). Stored in app-private `SharedPreferences`. Also hosts the battery-exemption button and triggers the `POST_NOTIFICATIONS` runtime request; while permission is denied the screen shows the config-blocked state (Feed rule 3) so the user knows rows are pending, not lost.
- **Entered once** (north-star requirement): inject the PWA password-wall values into the page's localStorage via `androidx.webkit` `WebViewCompat.addDocumentStartJavaScript` (guarded by `WebViewFeature.isFeatureSupported(DOCUMENT_START_SCRIPT)` — the standard path on any modern WebView): keys **`convexUrl`** and **`adminPassword`** (exact keys from `LoginGate.js:7-8`) — the web UI's `LoginGate` then skips its login form. If the feature is genuinely unsupported, the fallback must not race `LoginGate`: inject via `evaluateJavascript` **before** calling `loadUrl` on `about:blank`-origin, or gate the first `loadUrl` until injection completes — never fire-and-forget in `onPageStarted`. No new auth machinery.
- **Webview dormancy is MANDATORY, hand-implemented (Decision D-dormancy, ratified — this is the battery guardrail, AC6 / mental-model "the UI's chatty telemetry subscriptions must never run in the background").** All three reviewers verified against Capacitor 8.5.1 source: **the Bridge does NOT pause the webview on background.** `Bridge.onPause`/`onStop` only notify plugins; `KeepRunning` defaults to `true`, and `pauseTimers()` is never called — backgrounded JS timers and the UI's Convex WebSocket keep running by default. Required, not conditional:
  - `capacitor.config.ts`: `android.keepRunning = false` (i.e. `KeepRunning=false`).
  - `MainActivity.onStop()` → `bridge.webView.onPause()` + `bridge.webView.pauseTimers()`.
  - `MainActivity.onStart()` → `bridge.webView.onResume()` + `bridge.webView.resumeTimers()` (before any deep-link `loadUrl`).
  - This is a **code-reviewed acceptance behavior**: the review checklist verifies these exact lifecycle calls exist, with no code path that backgrounds the activity while leaving timers live. There is no "verify then maybe add" — the default is known-insufficient.
  - Acceptance framing: no UI-originated Convex traffic while backgrounded; the only background traffic is the service's single feed subscription keepalive.

### Idle-traffic budget (north-star cucumber)

Phone idle ⇒ exactly one WebSocket held by the Convex Kotlin client (its own keepalive), zero polling loops, zero webview traffic. The service performs Convex I/O only when the subscription delivers rows (post/ack/persist) — nothing scheduled, nothing periodic.

## Dependency Map

```
setup-toolchain.sh ──┐
Capacitor scaffold ──┼── native shell (service/protocol/notifications/reply/config)
                     │        │
UI ?thread param ────┘        │   (independent of native work; ~3 lines)
                              ▼
                      APK build + Kotlin unit tests
                              ▼
                      review (fan-out) → [conditional fix] → document (hand-off note)
```

Everything buildable is one vertical slice; the UI param is trivially parallel but not worth a separate job (calibration cost > work). **One implement job carries WP-A whole.**

## Work Package Breakdown

### WP-A (single implement job): scaffold + native shell + UI param + APK

**Mandatory execution order** (the toolchain is the riskiest unknown — prove it before investing in service code): ① `setup-toolchain.sh` incl. Node 22 → ② Capacitor 8.5.1 scaffold → ③ scaffold cleanup: strip google-services boilerplate + add Kotlin/serialization Gradle plugins (pinned 2.0.21) + grep-clean assertion → ④ **pinned-stack smoke `assembleDebug`** (AGP 8.13.0 / Gradle 8.14.3 / JDK 21 / SDK 36 / Kotlin 2.0.21 — the feasibility smoke ran on a different stack; this closes that gap or halts early) → ⑤ service/notifications/reply/config/`?thread=`/tests → ⑥ final APK.

Deliverables:
1. `workflow-engine/android-shell/` Capacitor 8.5.1 project (pinned versions above), `.gitignore` covering `android/app/build`, `node_modules`, local SDK paths; **no entry in any validate gate** (verified: all four gates are path-scoped elsewhere and cannot see this directory — keep it that way per north star).
2. `scripts/setup-toolchain.sh` (idempotent; the feasibility chain above incl. **Node 22 tarball, PATH-scoped**, SDK under `~/.android-toolchain`).
3. Scaffold cleanup applied and asserted: no `google-services` classpath/apply anywhere; `org.jetbrains.kotlin.android` + `org.jetbrains.kotlin.plugin.serialization` @ 2.0.21 wired into the Gradle files; the firebase/fcm/google-services/web-push/push-plugin grep (see Architecture Design) returns zero hits.
4. `ShellApplication.kt` (ConvexHolder singleton), `FeedListenerService.kt`, `NotificationPoster.kt`, `ReplyReceiver.kt`, `ConfigActivity.kt`, `MainActivity` wiring (incl. the mandatory onStop/onStart webview pause/resume calls + `keepRunning=false`) — per Architecture Design.
5. Pure-logic classes + **Kotlin JVM unit tests** (no emulator, no Android deps — plain JUnit via `./gradlew :app:testDebugUnitTest`):
   - `FeedProtocolTest`: advance only when `nextCursor != null`; empty page never advances; **emitted cursor arg is typed `Double` and `limit` is `Double`** (never Int/Long — a `$integer` arg kills the subscription server-side, invisible to these tests, so the type is pinned here at the source); **cursor persist→load round-trips bit-identical via `doubleToRawLongBits`/`fromBits` for a fractional value**; fresh-install drain-to-latest keeps last non-null cursor and posts nothing; empty-table fresh install leaves cursor null; `deliveredAt != null` rows are skipped for posting but advanced past (re-served delivered row → no post, cursor advances); **failed/unpermitted post ⇒ row not acked, cursor not advanced**; **`markDelivered` failure ⇒ cursor not advanced/persisted**; full-page batch yields immediate-resubscribe signal; batch action order is confirmed-post → ack → persist.
   - `PayloadMapperTest`: row → (per-thread notification identity as `tag=threadId` + constant id, title verbatim via `setConversationTitle`, MessagingStyle person = local user with row body as the incoming sender's message, body verbatim — a 5000-char body passes through byte-identical, no truncation/transformation).
   - `ReplyMarshalerTest`: (threadId, dictated text) → exactly `[chatMessages:add {password, threadId, role:"user", content}, chatJobs:trigger {password, threadId, triggerMessageId}]` in order; no harness/model args; no `chatThreads:markRead` in any emitted descriptor.
6. The `ChatPanel.js` `?thread=` initializer (the ONE permitted UI change — nothing else in `workflow-engine/ui` or any engine surface changes).
7. **Built APK** at a stated output path (`android/app/build/outputs/apk/debug/app-debug.apk`), produced in-container via the toolchain script; build command + output path recorded in the job result.

Decision guards (verbatim north-star): no uat jobs; zero engine changes beyond deliverable 6 (the `?thread=` initializer); never touch the runner process; no Convex deploys (nothing here needs one — consume-only); validate CLI stays green with the Android build **not** wired into its gates.

**Success criteria:**
1. `npx tsx .agents/tools/validate/cli.ts` → `ok: true` (gates untouched by the new directory; UI change passes deploy-shape).
2. `./gradlew :app:testDebugUnitTest` green in-container; test run output included in job result (these tests are the AC1 evidence for the cursor rules, including the Double-type and bit-exact-persistence assertions).
3. `app-debug.apk` exists, built in-container on the pinned stack; `apksigner verify` (debug cert) passes.
4. Code review can trace every north-star cucumber scenario: row → MessagingStyle notification (title/body verbatim, correct local-user Person model); inline reply → mutable per-thread PendingIntent → `goAsync()`-scaffolded receiver → the two traced mutations via the shared ConvexHolder client, `lastReadAt` untouched; tap → Activity PendingIntent → webview at Uri-built `?thread=<id>`; offline catch-up honors the advance rule + fresh-install-at-latest; permission-denied ⇒ config-blocked, zero rows acked; idle = one subscription only.
5. Every native `subscribe` call references only `notifications:feed` (the steady-state service holds exactly one live subscription; the fresh-install drain's `.first()` pages are transient and sequential); grep-clean of `markRead`, `jobs:`, `assignments:`, `chatThreads:`, telemetry queries.
6. FGS is `specialUse` (not `dataSync`); manifest carries the subtype property + all three permissions; POST_NOTIFICATIONS requested at runtime and delivery-acking gated on it.
7. No-FCM grep (firebase/fcm/google-services/web-push/push plugins) returns zero hits across the committed tree.
8. `MainActivity` contains the mandatory dormancy lifecycle calls (`onStop` → `webView.onPause()`+`pauseTimers()`; `onStart` → resume) and config sets `keepRunning=false` — verified by review, not asserted.

### WP-B (document job): USER HAND-OFF NOTE

The assignment's terminal artifact (north-star AC7). Must contain, concretely:
1. Sideload steps: enable installing unknown apps on the Pixel, `adb install` **and** file-transfer alternatives; APK location in-repo (or how to rebuild: `scripts/setup-toolchain.sh` then `./gradlew assembleDebug`, output path).
2. First-run config: the three fields (Convex prod URL `https://<convex-deployment>.convex.cloud`, admin password, deployed web UI URL), what each does, that the webview login is auto-seeded.
3. Battery-optimization exemption: the in-app button, plus the manual Settings path (Settings → Apps → [shell] → Battery → Unrestricted).
4. Silencing the persistent service notification: long-press → channel settings → minimize/silence (channel already `IMPORTANCE_MIN`).
5. **Known-unknown to test FIRST** (mental-model Open Question, user-owned finding): whether the assistant reads the full ~5k body aloud or truncates its reading — dictate a reply to a long rendition and observe. If it truncates, the rendition ceiling shrinks engine-side later (not this phase).
6. Failure posture reminders: app killed ⇒ reopen it; runner down ⇒ audio channel down with everything else (by design, no fallback channel).
7. Statement that no crew job performed device verification (UAT is the user's hands — hard guardrail).
8. One-line behavior note (per PM-resolved D10): tapping a notification opens the thread in the web UI, which marks it read exactly as opening it at the desk would — only *hearing* a rendition and *dictating a reply* leave the thread unread.

**Success criteria:** all eight items present with real values/paths; no invented device-verification claims.

## Assignment-Level Success Criteria

1. All eight north-star acceptance criteria satisfied — verified by review + Kotlin unit tests + in-container APK build, never by device testing.
2. Zero engine changes: `workflow-engine/convex/`, runner, notify pipeline untouched; the only `workflow-engine/ui` diff is the `?thread=` initializer (recorded here as the exercised one-time exception).
3. Toolchain decision recorded (this doc, up front): in-container APK build feasible and exercised.
4. Feed contract consumed as-is: advance-only-on-non-null-cursor and fresh-install-at-latest unit-tested; `markDelivered` used as the replay-guard ack.
5. Reply path mirrors `ChatPanel.handleSendMessage` byte-for-byte at the mutation level; `lastReadAt` untouched.
6. Foreground service holds exactly one subscription; webview subscriptions dormant in background.
7. Validate CLI green throughout; Android build not wired into validate gates.
8. USER HAND-OFF NOTE delivered per WP-B.

## Ambiguities / Decisions Made (flag to PM — overturn by decision record if wrong)

- **D1 — Toolchain: in-container APK build is GO** (Rosetta + amd64 multiarch libs; empirically proven). Deliverable shape = real APK + rebuild instructions.
- **D2 — Capacitor 8.5.1 over 7.6.9.** Current major; identical feasibility (JDK 21 either way); no reason to start one major behind. Convex Kotlin client 0.8.0 (latest on Maven Central, verified).
- **D3 — Webview points at the deployed UI URL, not bundled assets.** UI updates never require an APK rebuild; deep-link is a plain query param. Recorded as the north star's lean choice, validated against deep-link mechanics (no Capacitor App-plugin deep-link machinery needed at all).
- **D4 — RESOLVED (PM): deployed UI URL is a runtime config-screen field**, not a build-time constant, per D3 — the URL is not recorded anywhere in-repo, and a config field keeps the APK rebuild-free if the deployment moves. No longer open.
- **D5 — Notification tap = full webview reload with `?thread=`** (v1). An in-page event bridge (no reload) is a follow-up nicety, deliberately skipped; drafts survive via existing localStorage persistence.
- **D6 — No BOOT_COMPLETED receiver.** "App killed = reopen it" is the settled posture; auto-start-on-boot is scope creep against it.
- **D7 — Kotlin JVM tests via Gradle, not validate gates.** The pure logic lives in Kotlin (testing the shipped code beats a TS twin that tests nothing real). The assignment's "runnable under existing validate gates" phrasing predates the toolchain verdict; with the toolchain present, `./gradlew testDebugUnitTest` runs in-container and its green run is reported as WP-A evidence. Validate gates stay node-scoped and green by construction.
- **D8 — Per-thread MessagingStyle stacking** (notification identity = `tag=threadId` + constant id — not a hash; messages appended) over one-notification-per-row: matches the "conversation" semantics assistants expect, and makes crash-replay idempotent.
- **D9 — Reply failure handling = repost notification with a failure line, no retry.** Matches the system-wide fire-and-forget posture; the user can open the app. Feed-path `markDelivered` failure is now specified separately (Feed rule 4): no cursor advance, reactive re-emit retries, tag-based dedup makes reposting safe.
- **D10 — RESOLVED (PM): tap-open marks the thread read (existing UI behavior) is correct** — only reply/hearing must not mark read; the mental model's decoupling is about the audio surface, not about actually opening the thread. Surfaced as a one-line item in the WP-B hand-off note (not a code guardrail).
- **D-cursor — Cursor is `Double` end-to-end, persisted bit-exact** (ratified post-review). Convex `v.number()` = Float64; Kotlin Int/Long serialize as `$integer` and fail arg validation, silently killing the subscription after the first advance — invisible to JVM tests, so the DTO/arg types and `doubleToRawLongBits` persistence are pinned by `FeedProtocolTest`. See Feed rule 0.
- **D-dormancy — Webview background-pause is mandatory, hand-implemented** (ratified post-review). Capacitor's Bridge never pauses the webview (`KeepRunning` defaults true; `pauseTimers()` never called) — `MainActivity.onStop` → `onPause()`+`pauseTimers()`, `onStart` → resume, `keepRunning=false`, enforced as a code-review acceptance behavior. See § Config screen + webview.
- **D11 — Node 22 via PATH-scoped tarball; pinned-stack smoke build precedes service code.** Container Node is v20.20.0 and `@capacitor/cli@8.5.1` requires ≥22 (verified live); Node 22 is installed to `~/.android-toolchain/node-22` without touching the repo-default Node that validate runs on. The feasibility smoke ran on AGP 8.7.2/JDK 17/SDK 35 — WP-A step ④ smoke-builds the actual pinned stack before any service code.
- **D12 — Kotlin + serialization Gradle plugins pinned at 2.0.21, added at scaffold time** (the Capacitor template is pure-Java; without them the first `.kt` file fails the build). kotlinx-serialization-json runtime moves to 1.7.3 to pair with the 2.0.x plugin.
- **D13 — Google-services/Firebase scaffold boilerplate stripped, enforced by grep** (no-FCM guardrail made mechanical; see Architecture Design cleanup block).
- **D14 — Delivery ack is permission-gated.** Rows are `markDelivered`-ed and the cursor advanced only after a *confirmed* native post; permission-denied ⇒ config-blocked state, rows stay pending. Fresh-install drain is exempt (posts nothing by design).
- **D15 — Reply receiver: `FLAG_MUTABLE` per-thread broadcast PendingIntent + `goAsync()`/`finish()` in finally + shared ConvexHolder client.** Required by Android RemoteInput/BroadcastReceiver lifecycle; without `goAsync` the process can die before the mutations land.

## Recommended Job Sequence

1. **implement** (WP-A) — single job; TDD per AOP (FeedProtocol/PayloadMapper/ReplyMarshaler tests first); ends with in-container APK + green gradle tests + green validate.
2. **review** (fan-out per namespace config) — brief reviewers explicitly on: hard guardrails (no uat, zero engine changes except the recorded `?thread=` initializer, no runner touch, no deploys), cucumber traceability, the cursor advance rule **and Double typing/bit-exact persistence (D-cursor)**, single-subscription check (WP-A criterion 5), `specialUse` FGS typing, `row.body`/`row.title` used verbatim, **the mandatory dormancy lifecycle calls (D-dormancy — criterion 8)**, the no-FCM grep (criterion 7), permission-gated acking (D14), and the reply PendingIntent flags + `goAsync` lifecycle (D15).
3. **implement** (conditional) — only if review finds substantive issues.
4. **document** (WP-B) — hand-off note; closes the assignment.

No uat job at any point (hard guardrail — UAT is the user's hands on the Pixel).
