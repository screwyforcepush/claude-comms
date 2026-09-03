# Voice Loop Android Shell - User Hand-Off Note

## APK

Built debug APK:

```bash
workflow-engine/android-shell/android/app/build/outputs/apk/debug/app-debug.apk
```

Install with adb:

```bash
adb install -r workflow-engine/android-shell/android/app/build/outputs/apk/debug/app-debug.apk
```

File-transfer alternative: copy the APK to the Pixel, open it from Files, and allow that app to install unknown apps when Android prompts.

To rebuild in this repo:

```bash
cd workflow-engine/android-shell
./scripts/setup-toolchain.sh
eval "$(./scripts/setup-toolchain.sh --print-env)"
cd android
./gradlew :app:assembleDebug
```

## First Run

The config screen asks for:

- Convex URL: `https://utmost-vulture-618.convex.cloud`
- Admin password: the same single-user password used by the PWA wall
- Web UI URL: the deployed Workflow Engine UI URL

The shell stores these in app-private preferences and seeds the wrapped web UI localStorage keys `convexUrl` and `adminPassword`, so the PWA login wall should already be satisfied inside the WebView.

## Pixel Settings

Grant notification permission when prompted. If it is denied, feed rows remain pending; the shell does not ack or advance them.

Use the in-app battery button, or set it manually:

Settings -> Apps -> Claude Comms Voice Loop -> Battery -> Unrestricted

To silence the persistent listener notification:

Long-press the "Feed listener" notification -> notification settings -> minimize or silence that channel. The channel is already created at minimum importance.

## Test First

The known unknown to test first is assistant read-aloud length: send or wait for a long rendition near the 5000-character ceiling and observe whether the Pixel assistant speaks the full body or truncates. If it truncates, the rendition target should shrink engine-side later. This phase does not change the engine.

Dictate an inline reply from the notification and confirm the normal chat response is triggered. Hearing a notification and dictating a reply do not mark the thread read. Tapping the notification opens the thread in the web UI, and that marks it read exactly like opening it at the desk.

## Failure Posture

If the app is killed, reopen it. There is no FCM, Firebase, or web-push fallback by design.

If the runner is down, the audio channel is down with the rest of the system.

No crew job performed device verification. Pixel sideload, assistant read-aloud, and dictated reply verification are user-owned UAT.
