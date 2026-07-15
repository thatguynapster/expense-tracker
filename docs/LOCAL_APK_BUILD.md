# Building a Local APK for Manual Distribution

This covers how to build an installable Android APK from this repo **without** an EAS/Expo account or a Google Play Console account — purely local tooling, for sideloading onto your own device(s) until you're ready to publish properly.

This project uses Expo's **managed workflow** (no `android/` folder is committed). To produce a native APK we generate that folder on demand (`expo prebuild`) and build it with Gradle directly. This is the standard "bare" escape hatch and is fully supported by Expo.

## Known issue: intermittent build failures under system load

Local Android builds on this machine have, in the past, failed intermittently with either:
```
ninja: error: manifest 'build.ninja' still dirty after 100 tries
```
or
```
Failed to run Gradle Worker Daemon ... connection attempt hit a timeout after 120.0 seconds ... build machine is extremely loaded
```

**Root cause: insufficient free RAM/CPU while other heavy apps (Android Studio, VS Code, browser) are running** — not a project-specific bug, and not Windows path length. A multi-day investigation chased several false leads first (path length / `CMAKE_OBJECT_PATH_MAX`, Windows Defender real-time scanning, stale build caches, and even a full project rebuild from a fresh scaffold to rule out the original project's Replit/pnpm-monorepo origins). The fresh scaffold got further — JS bundling and CMake native compiles succeeded cleanly — but still hit the same Gradle Worker Daemon timeout under load, and closing other programs resolved it there too, confirming machine load was the actual cause all along.

**If a local build fails or hangs:** close other heavy applications (Android Studio, browser, VS Code, etc.) and re-run the build in isolation before investigating anything more exotic (path length, cache clearing, antivirus, ninja/cmake versions). The current project also lives at a short path (`C:\PROJECTS\Mobile\folio-expense-tracker`), so path length isn't a realistic factor here regardless.

**Alternative that sidesteps local machine load entirely:** `eas build --platform android` (Expo's cloud build service) builds on Expo's own infrastructure instead of locally. Requires a free Expo account; see §7 below.

## Shortcut: one command for prebuild + Gradle build

Once the one-time setup in §1 is done (Android SDK/JDK env vars set, `.env` created), steps 3 and 4 below are chained into a single npm script — from the project root (`C:\PROJECTS\Mobile\folio-expense-tracker`):

```bash
npm run build:apk:dev    # debug build, output: android/app/build/outputs/apk/debug/app-debug.apk
npm run build:apk:prod   # release build, output: android/app/build/outputs/apk/release/app-release.apk
```

Both run `expo prebuild --platform android --no-install && cd android && gradlew.bat assembleDebug|assembleRelease` (see `package.json`). Unlike the earlier version of this doc, these plain npm scripts **do not** set `ANDROID_HOME`/`JAVA_HOME` for you — make sure those are already set in your shell (§1) or as permanent user environment variables before running either command.

**Which one should I install on my phone?** They behave very differently, not just in size:
- **`build:apk:dev` (debug) does not embed the JS bundle.** The React Native Gradle plugin treats the `debug` variant as "debuggable" by default (`debuggableVariants`, unoverridden in `android/app/build.gradle`), which means it's built to fetch the JS bundle live from a running Metro dev server (`expo start`) instead of packaging it into the APK. Install this and it'll require your laptop/Metro to be reachable to actually run — that's by design (it's what gives you Fast Refresh and dev tooling during active development), not a bug.
- **`build:apk:prod` (release) embeds the JS bundle at build time** (a `bundleReleaseJsAndAssets` task runs as part of `assembleRelease`), so the resulting APK is fully standalone — install it and it runs with zero dependency on your laptop or network. **Use this one for "test it like a real app" / sideloading to a device you're walking away from.**

There's also a `scripts/build-apk.sh` in the repo that sets those env vars for you before building — but it's currently **not** wired into `package.json` and still references the old `pnpm`-based workflow, so it's out of date. Don't rely on it as written; either set the env vars yourself first (§1), or ask for it to be updated to match the current npm-based scripts if you want that convenience back.

---

## 1. One-time machine setup

You need three things: a JDK, the Android SDK, and env vars pointing at both. On this machine, Android Studio is already installed at `C:\Program Files\Android\Android Studio`, which conveniently bundles a JDK, and the SDK is already installed at `C:\Users\buro\AppData\Local\Android\Sdk` with platforms 34/36 and build-tools 35.0.0/36.1.0 — so no separate downloads were needed.

**The exact two variables needed, with their full real paths on this machine:**

| Variable | Full path |
|---|---|
| `ANDROID_HOME` | `C:\Users\buro\AppData\Local\Android\Sdk` |
| `JAVA_HOME` | `C:\Program Files\Android\Android Studio\jbr` |

Set these every time you open a fresh terminal to build (or add them to your permanent user environment variables via *System Properties → Environment Variables* so you don't have to repeat this — see below):

**Git Bash / WSL-style shell:**
```bash
export ANDROID_HOME="C:\Users\buro\AppData\Local\Android\Sdk"
export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
```

**PowerShell:**
```powershell
$env:ANDROID_HOME = "C:\Users\buro\AppData\Local\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
```

Verify:
```bash
java -version   # should print OpenJDK 21.x
```

If you don't have Android Studio / the SDK on a given machine, install Android Studio from developer.android.com, open it once, and let its SDK Manager install "Android SDK Platform 36" and "Android SDK Build-Tools" — that alone gives you everything above without touching a config file.

**To make these permanent** instead of re-exporting every terminal session: *Windows Settings → System → About → Advanced system settings → Environment Variables* → add `ANDROID_HOME` and `JAVA_HOME` as new **User variables** with the exact values from the table above, then add `%JAVA_HOME%\bin` and `%ANDROID_HOME%\platform-tools` to your `PATH` variable.

### Sync config (separate from the Android SDK vars above)

The app's cloud-sync feature needs its own config, read from a `.env` file — **not** an OS-level environment variable, and unrelated to `ANDROID_HOME`/`JAVA_HOME`.

Full path: **`C:\PROJECTS\Mobile\folio-expense-tracker\.env`**

This file is gitignored and must be created manually on each machine you build from. Copy the template and fill in real values:
```bash
cp "C:\PROJECTS\Mobile\folio-expense-tracker\.env.example" "C:\PROJECTS\Mobile\folio-expense-tracker\.env"
```
Then edit it to contain:
```
EXPO_PUBLIC_SYNC_SERVER_URL="https://folio-server-rmsl.vercel.app"
EXPO_PUBLIC_SYNC_API_KEY="<the real SYNC_API_KEY value, matching what's set in folio-server's Vercel project>"
```
Both must be prefixed `EXPO_PUBLIC_` — Expo's Metro bundler only inlines env vars with that exact prefix into the built JS bundle. This file is read automatically the moment you run `expo prebuild` (step 3 below) or `expo start` — nothing else needs to source it manually. If either variable is missing, the app still builds and runs fine; sync is just treated as unconfigured (a silent no-op, never a crash).

**Dev vs. release builds read different `.env` files.** Expo loads env files based on `NODE_ENV`, which it sets automatically: `development` for `expo start` / `gradlew assembleDebug` (i.e. `npm run build:apk:dev`), `production` for `gradlew assembleRelease` (i.e. `npm run build:apk:prod`). Precedence per mode is `.env.<mode>.local` → `.env.local` → `.env.<mode>` → `.env`. In practice: the base `.env` above currently holds the real production values and doubles as the production fallback. If you want the dev build pointed at a different (e.g. local) sync server without touching that, add a `.env.development.local` with the override — it's covered by the `.env*.local` gitignore rule and only ever gets picked up by dev/debug builds, never `build:apk:prod`.

---

## 2. Install workspace dependencies

From the project root (`C:\PROJECTS\Mobile\folio-expense-tracker`):
```bash
npm install
```

---

## 3. Generate the native Android project

From the project root:
```bash
npx expo prebuild --platform android --no-install
```

This creates an `android/` folder (gitignored) containing a full native Gradle project derived from `app.json`. Re-run this command any time you change `app.json` (name, icon, package id, permissions, plugins) — it's safe to re-run; it regenerates the native project from scratch each time.

Notable config already set for you in `app.json`:
- `expo.android.package` — the Android application ID (`com.anonymous.folioexpensetracker` as of this writing). **This cannot be changed after you've installed the app on a device without uninstalling first** — Android treats a different package id as a different app.
- `expo.name` / `expo.slug` — display name and internal slug.

---

## 4. Build the APK

From `android`:
```bash
./gradlew assembleRelease   # or assembleDebug for a debug build
```
(`npm run build:apk:prod` / `build:apk:dev` from the project root do steps 3–4 together — see the Shortcut section above. Those npm scripts invoke `gradlew.bat` directly since `npm run` spawns them via `cmd.exe` on Windows; `./gradlew` works the same way from Git Bash if you're running the steps manually.)

First run will take several minutes (Gradle downloads its own toolchain + all native Android dependencies the first time; subsequent builds are much faster thanks to the Gradle cache). Output APK lands at:
```
android/app/build/outputs/apk/release/app-release.apk   (or .../debug/app-debug.apk)
```

### Troubleshooting: NDK auto-download stalls or fails

By default, `expo prebuild` configures the project to require the exact NDK/build-tools versions Expo's current SDK recommends (as of this build: NDK `27.1.12297006`, build-tools `36.0.0`). If those exact versions aren't already installed, Gradle tries to download them automatically via the SDK manager — and on a slow or flaky connection this can silently stall for a very long time (observed: stuck downloading the NDK with zero progress for 15+ minutes), or fail outright under `--offline`.

If you already have a *different* NDK/build-tools version installed (check with `ls "$ANDROID_HOME/ndk"` and `ls "$ANDROID_HOME/build-tools"`) and don't want to wait for a fresh ~1GB download, force Gradle to use what's already there by adding this to `android/build.gradle`, right after the `apply plugin: "expo-root-project"` line:
```groovy
ext {
  ndkVersion = "27.0.12077973"       // replace with your installed version
  buildToolsVersion = "36.1.0"       // replace with your installed version
}
```
**This edit is lost every time you re-run `expo prebuild`** (it regenerates `android/` from scratch), so you'll need to reapply it after every prebuild if you hit this again. Don't combine this with `--offline` — Gradle still needs a network round-trip to *verify* an already-installed SDK component even when no download is actually required, and `--offline` blocks that verification, causing a different failure ("NDK not configured").

### Troubleshooting: build hangs or fails under system load

See "Known issue" at the top of this doc — this is the realistic failure mode on this machine, not path length or a project bug. Close other heavy applications and retry before investigating anything else.

### About signing
Expo's generated template configures the `release` build type to sign with the same **debug keystore** (`android/app/debug.keystore`) that's used for development builds. This is intentional for local/manual builds — it produces a fully functional, installable release APK. It is **not** suitable for the Play Store (Play requires you to manage your own upload key), but for sideloading onto your own phone it's exactly what you want and requires zero extra setup.

---

## 5. Install on your device

**Option A — USB (fastest for testing on your own phone):**
1. Enable Developer Options + USB Debugging on the phone.
2. Plug it in, confirm the RSA prompt on the phone.
3. From the `android` folder:
   ```bash
   "$ANDROID_HOME/platform-tools/adb" install -r app/build/outputs/apk/release/app-release.apk
   ```

**Option B — Manual sideload (for friends/family without a USB cable):**
1. Copy `app-release.apk` to the phone (email it to yourself, Google Drive, WhatsApp, USB transfer — anything).
2. On the phone, tap the file. Android will prompt to allow installs from that source ("Install unknown apps") the first time — approve it.
3. Install.

Each time you make code changes, repeat steps 3–4 above and reinstall (`adb install -r` overwrites in place and keeps app data, as long as the package id and signing key haven't changed).

---

## 6. Rebuilding after code changes

You do **not** need to re-run `expo prebuild` for ordinary JS/TSX changes (screens, store logic, styling) — only when you change `app.json` (icon, name, permissions, plugins) or add a native module. For a normal code change:
```bash
cd android
./gradlew assembleRelease
```
Or just re-run `npm run build:apk:prod` (or `build:apk:dev`) from the project root — it re-prebuilds and rebuilds in one step; the prebuild step is safe to re-run even when nothing native changed. Gradle bundles the current JS into the APK automatically as part of `assembleRelease`/`assembleDebug` (no separate Metro/bundle step needed, unlike Expo Go).

---

## 7. Later: moving to the Play Store

When you're ready for a Play Console account, you have two reasonable paths:
1. **EAS Build** (`eas build --platform android`) — Expo's cloud build service, handles a proper release keystore for you, produces an `.aab` (Play's required format) instead of an `.apk`. Requires a free Expo account.
2. **Stay local**: generate your own upload keystore with `keytool`, wire it into `android/app/build.gradle`'s `signingConfigs.release`, and run `./gradlew bundleRelease` to produce an `.aab`. More manual, but zero recurring cloud dependency.

Either way, the debug-keystore-signed APK described above is only for personal/manual distribution — Play Store submissions need a distinct signing key you control long-term (losing it means you can never update the app again under the same listing).
