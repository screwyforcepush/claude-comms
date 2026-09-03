# Voice Loop Android Shell — User Hand-Off Note

This is the sideloadable Android shell for the Hands-Free Voice Loop. Its entire job is
native notifications: a foreground service holds one Convex subscription to the
`notifications:feed`, posts each row as a MessagingStyle notification your Pixel assistant
can read aloud, and carries an inline reply that posts your dictated text back to the
thread as a normal user message. No FCM, no Firebase, no web push — Convex is the only pipe.

**No crew job performed device verification.** Sideloading onto the Pixel, confirming
assistant read-aloud, and confirming a dictated reply are user-owned UAT — only your hands
on the device can do them. Everything below is derived from the shipped code, not from a
device test.

---

## 1. Sideload the APK

Prebuilt debug APK (already built in-repo):

```
workflow-engine/android-shell/android/app/build/outputs/apk/debug/app-debug.apk
```

First, on the Pixel, allow installs from the app you'll install with (Settings → Apps →
Special app access → Install unknown apps → pick Files/your browser/etc. → Allow). This is
required for any sideload.

**Option A — adb (USB):** enable Developer options → USB debugging, plug in, then:

```bash
adb install -r workflow-engine/android-shell/android/app/build/outputs/apk/debug/app-debug.apk
```

**Option B — file transfer:** copy `app-debug.apk` to the phone, open it from the Files app,
and confirm the install-unknown-apps prompt.

### Rebuilding the APK yourself

The build runs in-container (or on any Linux/macOS box) via the pinned toolchain script:

```bash
cd workflow-engine/android-shell
./scripts/setup-toolchain.sh                       # installs Node 22, JDK 21, Android SDK 36 under ~/.android-toolchain
eval "$(./scripts/setup-toolchain.sh --print-env)" # puts that toolchain on PATH for this shell
cd android
./gradlew :app:assembleDebug
```

Output lands at `android/app/build/outputs/apk/debug/app-debug.apk`. The toolchain installs
to `~/.android-toolchain` and does **not** touch your machine's default Node/JDK.

---

## 2. First-run configuration

On first launch the app opens a config screen with **three fields**. All three are stored in
app-private storage and are entered once.

| Field | What it does | Value |
|---|---|---|
| **Convex URL** | The Convex deployment the foreground service subscribes to for the notifications feed. | `https://utmost-vulture-618.convex.cloud` (pre-filled) |
| **Admin password** | The single-user password that gates all Convex access (same one the web PWA login wall uses). | your admin password |
| **Web UI URL** | The deployed Workflow Engine web UI the shell wraps in its WebView; a notification tap deep-links here with `?thread=<id>`. | your deployed UI URL |

Tap **Save** to store them and enter the app.

**Auto-seeded web login:** the shell injects the Convex URL and password into the wrapped
WebView's `localStorage` under the keys `convexUrl` and `adminPassword` (the exact keys the
web UI's login gate reads), so the PWA password wall is already satisfied inside the app — you
do not log in a second time.

---

## 3. Grant notification permission

When prompted, allow notifications (or use the **Enable notifications** button on the config
screen). If notification permission is denied, incoming feed rows are held **pending** — the
shell will not acknowledge them or advance its feed cursor, so nothing is lost; it resumes
posting once permission is granted.

---

## 4. Battery-optimization exemption

The foreground service must stay alive to hold the feed subscription. Exempt it from battery
optimization one of two ways:

- **In-app:** tap the **Battery unrestricted** button on the config screen and accept the
  system prompt.
- **Manually:** Settings → Apps → **Claude Comms Voice Loop** → Battery → **Unrestricted**.

---

## 5. Silencing the persistent service notification

The service posts a quiet, ongoing "Feed listener active" notification (title *Claude Comms*)
on its own **Feed listener** channel, which is already created at minimum importance. To hide
it further: long-press that notification → open its notification/channel settings → minimize or
silence the **Feed listener** channel. (This is separate from the high-priority **Messages**
channel that carries the actual renditions — do not silence that one.)

---

## 6. Known-unknown to test FIRST

The one open question this phase cannot answer (it needs your device and voice assistant):
**does the assistant read the full ~5000-character body aloud, or does it truncate?**

To test: dictate/send a reply to a thread that produces a long rendition (near the 5k
ceiling) and listen to whether the assistant speaks the whole body. If it truncates, the
rendition length ceiling would need to shrink **engine-side later** — this shell never
transforms or truncates the body; it posts it verbatim, so this is an engine tuning finding,
not a shell change.

---

## 7. Reply and read behavior

- Dictating an inline reply from a notification posts your text to that thread as a normal
  user chat message (same `chatMessages:add` → `chatJobs:trigger` path a typed web-UI message
  uses), which triggers the usual assistant response.
- **Hearing** a rendition and **dictating a reply** leave the thread **unread** — you can come
  back later and read the real message with its tables/code/links intact.
- **Tapping** a notification opens that thread in the wrapped web UI, which marks it read
  exactly as opening it at your desk would. That is intended: a tap means you're actually
  looking at the message.

---

## 8. Failure posture (by design — no fallback)

- **App killed?** Reopen it. There is no FCM/Firebase/web-push fallback; "app killed = reopen
  it" is the accepted posture.
- **Runner down?** The audio channel is down with the rest of the system — renditions stop
  being produced upstream, so the shell has nothing to post. Nothing to do but wait for the
  system to recover.
