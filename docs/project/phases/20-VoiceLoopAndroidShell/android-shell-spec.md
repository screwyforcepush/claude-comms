# Hands-Free Voice Loop — Android Shell (Spec)

Phase: `20-VoiceLoopAndroidShell`
Status: PLANNED
Why-layer: `docs/project/spec/mental-model.md` § "Hands-Free Voice Loop (Mobile)" — read in full before implementing. All settled decisions (no FCM/Firebase/web-push, foreground-service Convex listener, MessagingStyle+RemoteInput as the entire point, reply never marks read, feed-only background subscription, "app killed = reopen it" failure posture) live there and in the north star and are **not** relitigated here.
Engine contract consumed (read-only): `docs/project/phases/19-HandsFreeVoiceLoop/engine-spec.md`, `workflow-engine/convex/notifications.ts`.

## Toolchain Feasibility Decision (settled first, empirically)

**VERDICT: FEASIBLE — an APK builds inside this container. The signed-or-debug APK is a validate-able deliverable of the implement job.**

Proven by smoke test (2026-09-03): a minimal AGP `assembleDebug` produced `app-debug.apk` in-container. The chain and why it works:

- Host is **linux/aarch64** (Docker Desktop, linuxkit kernel). Android's native build tools (aapt2 etc.) ship **x86-64-only** Linux binaries — normally a hard blocker on arm64.
- **Docker Desktop's Rosetta binfmt handler is present** in this container. The only missing piece was the x86-64 userland: after `sudo dpkg --add-architecture amd64 && apt-get install libc6:amd64 libstdc++6:amd64 zlib1g:amd64`, Google's stock x86-64 `aapt2` executes cleanly under Rosetta (`aapt2 version` → exit 0).
- Everything else is JVM (arm64-native): Gradle, AGP, d8/r8, apksigner. JDK via apt/tarball. Network to `dl.google.com`, `services.gradle.org`, Maven Central, npm is open; disk is ample (1.4 TB free); passwordless sudo works.
- Smoke test exact chain: OpenJDK 17 (apt) + Gradle 8.10.2 + AGP 8.7.2 + cmdline-tools 11076708 + `platforms;android-35` + `build-tools;35.0.0/34.0.0` → APK. Capacitor 8 raises this to JDK 21 / AGP 8.13 / SDK 36 — same Rosetta path, same feasibility (JDK 21 is not in bookworm apt; use an Adoptium Temurin 21 **aarch64** tarball).
- No emulator anywhere (build-only, per north star). Device verification is exclusively the user's hands.

Consequence: **the fallback deliverable shape (buildable project + instructions only) is NOT taken.** Build instructions are still delivered in the hand-off note (the user may want to rebuild on their own machine), but the assignment terminates with a real APK.

**WP-A must ship `workflow-engine/android-shell/scripts/setup-toolchain.sh`** — idempotent, re-runs safely in a fresh container: amd64 multiarch libs, Temurin JDK 21 aarch64 tarball → `~/.android-toolchain/jdk-21`, cmdline-tools → `~/.android-toolchain/sdk`, `sdkmanager "platforms;android-36" "build-tools;36.0.0"`, license acceptance. SDK lives under `~` (not `/tmp`) so it survives container idles. The script is also the authoritative "build it yourself" documentation for the user.

## Purpose

The engine half is live and user-verified: renditions land in the prod `notifications` table (Phase 19). This phase builds the consumer — a thin Capacitor Android app whose entire reason to exist is native notifications. It subscribes to `notifications:feed` from a foreground service, posts each row as a MessagingStyle notification the Pixel's assistant can read aloud, carries a RemoteInput inline reply that posts the dictated text back to the thread exactly as a typed web-UI message would, and deep-links a tap to that thread in the wrapped web UI. Deliverable: a sideloadable APK.

## Overview

One new top-level project directory, one one-line UI change, zero engine changes:

| Surface | New file(s) / change | Notes |
|---|---|---|
| Capacitor project | `workflow-engine/android-shell/` (own `package.json`, `capacitor.config.ts`, `android/`) | Self-contained; no pnpm workspace exists at root, so no hoisting interference |
| Native service | `android/app/src/main/java/.../FeedListenerService.kt` | FGS `specialUse`, one Convex subscription |
| Notifications | `NotificationPoster.kt`, `ReplyReceiver.kt` | MessagingStyle + RemoteInput |
| Pure logic (unit-tested) | `FeedProtocol.kt`, `PayloadMapper.kt`, `ReplyMarshaler.kt` | JVM-only, no Android deps |
| Config screen | `ConfigActivity.kt` + SharedPreferences | convexUrl, adminPassword, uiUrl |
| Web UI (THE one permitted additive change) | `workflow-engine/ui/js/components/chat/ChatPanel.js` — initialize `selectedThreadId` from `?thread=` URL param | ~3 lines; additive; validate-green |
| Toolchain | `android-shell/scripts/setup-toolchain.sh` | See feasibility section |

**Pinned versions** (Decision D2): `@capacitor/cli` + `@capacitor/android` + `@capacitor/core` **8.5.1** (current major; AGP 8.13.0, compileSdk/targetSdk 36, Java 21, scaffold's own Gradle wrapper), `minSdk 26`, `dev.convex:android-convexmobile:0.8.0@aar` (`isTransitive = true`) + `org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3` (per Convex Android docs), `androidx.core:core-ktx` (NotificationCompat), `androidx.webkit:webkit` (document-start script injection). Temurin JDK 21 aarch64.

External research performed (Perplexity + registry/Maven verification): Convex Kotlin client capabilities, Capacitor 8 toolchain requirements, Android 14/15/16 FGS + notification rules. Key findings baked into the design below.

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
- Holds **exactly one** Convex subscription: `client.subscribe("notifications:feed", mapOf("password" to pw, "cursor" to storedCursor, "limit" to 50))` collected as a Flow in the service coroutine scope. No other query is ever registered from native code (AC2). The Convex Kotlin client auto-reconnects with backoff (Rust core) — do **not** hand-roll a second reconnect loop. Add only: (a) a `ConnectivityManager` network callback that nudges resubscription on network regain, (b) supervisor-scope catch that logs and restarts collection after a delay (30 s cap) if the Flow terminally errors.
- Battery-optimization exemption is a **documented user step** (config screen offers a button firing `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`; hand-off note documents the manual Settings path as fallback). Not an engineering workaround — mental-model posture.

### Feed cursor + markDelivered discipline (assignment item 6)

Contract facts (verified against live `convex/notifications.ts` — consume, never modify): `feed {password, cursor: number|null, limit ≤200 default 50}` → `{rows asc by _creationTime, nextCursor}`; cursor value is the last row's `_creationTime` (NOT `createdAt`); empty page ⇒ `nextCursor: null`. `markDelivered {password, ids}` stamps `deliveredAt`.

Shell discipline (all of this is pure logic in `FeedProtocol.kt`, unit-tested):

1. **Advance rule:** stored cursor advances **only when `nextCursor != null`**. An empty page never moves the cursor.
2. **Fresh install (no stored cursor):** drain-to-latest without posting — loop `feed(cursor, 200)` until `nextCursor == null`, keeping the last non-null `nextCursor`; persist it; post nothing. Clock-skew-proof (never synthesizes a cursor from device time). Empty table ⇒ cursor stays null, which is equivalent (nothing exists to replay).
3. **Live batch processing order:** post native notifications → `markDelivered(ids)` → persist advanced cursor → resubscribe at new cursor. A crash mid-sequence re-serves the same rows on restart; the next rule makes that safe.
4. **Replay guard:** a row with `deliveredAt != null` is **never posted again** (it was acked by a previous life) — the cursor still advances past it. Combined with notification IDs keyed by thread (below), the protocol is effectively exactly-once for the user with at-least-once plumbing. `deliveredAt` also covers reinstall (rule 2 makes it mostly moot; it remains the belt-and-braces ack).
5. **Full page (`rows.length == limit`):** the resubscription at the advanced cursor immediately fires with the remainder — no special drain path needed in live mode.
6. Cursor persisted in app-private `SharedPreferences` alongside config.

### Component: NotificationPoster (assignment item — MessagingStyle)

- Message channel at `IMPORTANCE_HIGH` (separate from the service channel).
- `NotificationCompat.MessagingStyle` with `Person.name = row.title` ("namespace · thread topic" — composed server-side, used verbatim) and `setConversationTitle(row.title)`; message text = `row.body` **verbatim** (body is pre-rendered listenable text ≤5000 chars — the shell never transforms, truncates, or re-wraps it; AC3).
- Notification ID = stable hash of `threadId` — multiple renditions in one thread append into one MessagingStyle conversation (recover via `MessagingStyle.extractMessagingStyleFromNotification` on the active notification; fall back to a fresh style if absent). Reposting the same row after a crash replaces in place (dedup for free).
- Tap: `contentIntent` = **Activity `PendingIntent` directly to `MainActivity`** (trampoline ban — no broadcast/service intermediary) with `threadId` extra, `FLAG_IMMUTABLE | FLAG_UPDATE_CURRENT`, distinct `requestCode` per thread.
- Inline reply: `RemoteInput` action ("Reply") whose `PendingIntent` targets `ReplyReceiver` (a BroadcastReceiver — background work from a notification action is legal; the trampoline ban only covers activity launches).

### Reply path (assignment item 4 — traced, mirrored byte-for-byte)

Trace result — the live web send path is `ChatPanel.js:631` `handleSendMessage` (note: the "use chatActions.sendMessage" comment in `api.js:98` is stale — no `chatActions` module exists; `addMessage` + `triggerChatJob` **is** the real path):

1. `chatMessages:add` `{password, threadId, role: "user", content}` → returns the new message id (`convex/chatMessages.ts:34` — also bumps thread `updatedAt`/`latestMessageAt` server-side).
2. `chatJobs:trigger` `{password, threadId, triggerMessageId: <id from step 1>}` (`convex/chatJobs.ts:21`). **No `harness`/`model` args** — the server resolves them from namespace `harnessDefaults` exactly as for a typed message; guardian/session routing is all server-side. Returns `{jobId, mode}` (shell ignores it).

`ReplyReceiver` extracts the RemoteInput text, calls these two mutations in order via the same Convex Kotlin client (marshaling built in pure `ReplyMarshaler.kt`), then reposts the notification with the reply appended as a `Person("You")` message (required to clear Android's inline-reply spinner). On mutation failure: repost with an "Reply failed — open the app" line appended; no retry machinery (v1 posture).

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

**Native side:** `MainActivity` (`launchMode="singleTask"`) reads the `threadId` extra in `onCreate`/`onNewIntent` and calls `bridge.webView.loadUrl(uiUrl + "?thread=" + threadId)`. Second tap while the app is open = full page reload with the new param — deliberate v1 simplicity (Decision D5); per-thread drafts already survive reloads via the UI's localStorage draft persistence.

Note on read-marking: opening the thread in the UI fires the UI's own `markRead` on selection — that is existing, correct behavior (the user is actually looking at the real message). The prohibition is only that **reply and rendition-hearing** never mark read, which holds.

### Config screen + webview (assignment items 2, 7)

- `capacitor.config.ts`: `server.url` is not used (it's static); instead `MainActivity` loads the **deployed web UI URL from config** at runtime. Bundled-assets option rejected (Decision D3): pointing at the deployed URL means UI updates never require an APK rebuild, and deep-linking is a plain query param on that URL — no Capacitor deep-link machinery needed at all.
- First-run: if prefs are empty, `MainActivity` routes to `ConfigActivity` — three fields: **Convex URL**, **password**, **web UI URL** (the deployed UI's URL is not recorded in-repo, so it's a config field, pre-fillable placeholder; Decision D4). Stored in app-private `SharedPreferences`. Also hosts the battery-exemption button and triggers the `POST_NOTIFICATIONS` runtime request.
- **Entered once** (north-star requirement): on webview page start, inject the PWA password-wall values into the page's localStorage via `androidx.webkit` `WebViewCompat.addDocumentStartJavaScript` (fallback: `evaluateJavascript` in `onPageStarted`): keys **`convexUrl`** and **`adminPassword`** (exact keys from `LoginGate.js:7-8`) — the web UI's `LoginGate` then skips its login form. No new auth machinery.
- **Webview dormancy (mental-model constraint):** Capacitor's bridge already calls `webView.onPause()`/`pauseTimers()` when the activity backgrounds, which freezes JS timers and with them the JS Convex client's socket upkeep. Implementer must verify this holds in the scaffold (trace `Bridge.onPause`) and add explicit `webView.onPause()` + `webView.pauseTimers()` in `MainActivity.onStop` if the default is insufficient. Acceptance framing: no UI-originated Convex traffic while backgrounded; the only background traffic is the service's single feed subscription keepalive.

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

Deliverables:
1. `workflow-engine/android-shell/` Capacitor 8.5.1 project (pinned versions above), `.gitignore` covering `android/app/build`, `node_modules`, local SDK paths; **no entry in any validate gate** (verified: all four gates are path-scoped elsewhere and cannot see this directory — keep it that way per north star).
2. `scripts/setup-toolchain.sh` (idempotent; the feasibility chain above, SDK under `~/.android-toolchain`).
3. `FeedListenerService.kt`, `NotificationPoster.kt`, `ReplyReceiver.kt`, `ConfigActivity.kt`, `MainActivity` wiring — per Architecture Design.
4. Pure-logic classes + **Kotlin JVM unit tests** (no emulator, no Android deps — plain JUnit via `./gradlew :app:testDebugUnitTest`):
   - `FeedProtocolTest`: advance only when `nextCursor != null`; empty page never advances; fresh-install drain-to-latest keeps last non-null cursor and posts nothing; empty-table fresh install leaves cursor null; `deliveredAt != null` rows are skipped for posting but advanced past; full-page batch yields immediate-resubscribe signal; batch action order is post → ack → persist.
   - `PayloadMapperTest`: row → (stable per-thread notification key, title verbatim, body verbatim — a 5000-char body passes through byte-identical, no truncation/transformation).
   - `ReplyMarshalerTest`: (threadId, dictated text) → exactly `[chatMessages:add {password, threadId, role:"user", content}, chatJobs:trigger {password, threadId, triggerMessageId}]` in order; no harness/model args; no `chatThreads:markRead` in any emitted descriptor.
5. The `ChatPanel.js` `?thread=` initializer (the ONE permitted UI change — nothing else in `workflow-engine/ui` or any engine surface changes).
6. **Built APK** at a stated output path (`android/app/build/outputs/apk/debug/app-debug.apk`), produced in-container via the toolchain script; build command + output path recorded in the job result.

Decision guards (verbatim north-star): no uat jobs; zero engine changes beyond item 5; never touch the runner process; no Convex deploys (nothing here needs one — consume-only); validate CLI stays green with the Android build **not** wired into its gates.

**Success criteria:**
1. `npx tsx .agents/tools/validate/cli.ts` → `ok: true` (gates untouched by the new directory; UI change passes deploy-shape).
2. `./gradlew :app:testDebugUnitTest` green in-container; test run output included in job result (these tests are the AC1 evidence for the cursor rules).
3. `app-debug.apk` exists, built in-container; `apksigner verify` (debug cert) passes.
4. Code review can trace every north-star cucumber scenario: row → MessagingStyle notification (title/body verbatim); inline reply → the two traced mutations, `lastReadAt` untouched; tap → Activity PendingIntent → webview at `?thread=<id>`; offline catch-up honors the advance rule + fresh-install-at-latest; idle = one subscription only.
5. Service code contains exactly one `subscribe` call, referencing only `notifications:feed`; grep-clean of `markRead`, `jobs:`, `assignments:`, `chatThreads:` (except none), telemetry queries.
6. FGS is `specialUse` (not `dataSync`); manifest carries the subtype property + all three permissions; POST_NOTIFICATIONS requested at runtime.

### WP-B (document job): USER HAND-OFF NOTE

The assignment's terminal artifact (north-star AC7). Must contain, concretely:
1. Sideload steps: enable installing unknown apps on the Pixel, `adb install` **and** file-transfer alternatives; APK location in-repo (or how to rebuild: `scripts/setup-toolchain.sh` then `./gradlew assembleDebug`, output path).
2. First-run config: the three fields (Convex prod URL `https://utmost-vulture-618.convex.cloud`, admin password, deployed web UI URL), what each does, that the webview login is auto-seeded.
3. Battery-optimization exemption: the in-app button, plus the manual Settings path (Settings → Apps → [shell] → Battery → Unrestricted).
4. Silencing the persistent service notification: long-press → channel settings → minimize/silence (channel already `IMPORTANCE_MIN`).
5. **Known-unknown to test FIRST** (mental-model Open Question, user-owned finding): whether the assistant reads the full ~5k body aloud or truncates its reading — dictate a reply to a long rendition and observe. If it truncates, the rendition ceiling shrinks engine-side later (not this phase).
6. Failure posture reminders: app killed ⇒ reopen it; runner down ⇒ audio channel down with everything else (by design, no fallback channel).
7. Statement that no crew job performed device verification (UAT is the user's hands — hard guardrail).

**Success criteria:** all seven items present with real values/paths; no invented device-verification claims.

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
- **D4 — Deployed UI URL is a config-screen field**, not a build-time constant — the URL is not recorded anywhere in-repo, and a config field keeps the APK rebuild-free if the deployment moves. (PM/user: if you'd rather bake it, hand the URL to the implement job as context.)
- **D5 — Notification tap = full webview reload with `?thread=`** (v1). An in-page event bridge (no reload) is a follow-up nicety, deliberately skipped; drafts survive via existing localStorage persistence.
- **D6 — No BOOT_COMPLETED receiver.** "App killed = reopen it" is the settled posture; auto-start-on-boot is scope creep against it.
- **D7 — Kotlin JVM tests via Gradle, not validate gates.** The pure logic lives in Kotlin (testing the shipped code beats a TS twin that tests nothing real). The assignment's "runnable under existing validate gates" phrasing predates the toolchain verdict; with the toolchain present, `./gradlew testDebugUnitTest` runs in-container and its green run is reported as WP-A evidence. Validate gates stay node-scoped and green by construction.
- **D8 — Per-thread MessagingStyle stacking** (notification ID keyed by threadId, messages appended) over one-notification-per-row: matches the "conversation" semantics assistants expect, and makes crash-replay idempotent.
- **D9 — Reply failure handling = repost notification with a failure line, no retry.** Matches the system-wide fire-and-forget posture; the user can open the app.
- **D10 — Tap-open marks the thread read (existing UI behavior) is correct** — only reply/hearing must not mark read; the mental model's decoupling is about the audio surface, not about actually opening the thread.

## Recommended Job Sequence

1. **implement** (WP-A) — single job; TDD per AOP (FeedProtocol/PayloadMapper/ReplyMarshaler tests first); ends with in-container APK + green gradle tests + green validate.
2. **review** (fan-out per namespace config) — brief reviewers explicitly on: hard guardrails (no uat, zero engine changes except the recorded `?thread=` initializer, no runner touch, no deploys), cucumber traceability, the cursor advance rule, single-subscription check (WP-A criterion 5), `specialUse` FGS typing, and that `row.body`/`row.title` are used verbatim.
3. **implement** (conditional) — only if review finds substantive issues.
4. **document** (WP-B) — hand-off note; closes the assignment.

No uat job at any point (hard guardrail — UAT is the user's hands on the Pixel).
