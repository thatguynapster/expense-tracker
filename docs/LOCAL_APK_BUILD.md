# Building a Local APK for Manual Distribution

This covers how to build an installable Android APK from this repo **without** an EAS/Expo account or a Google Play Console account — purely local tooling, for sideloading onto your own device(s) until you're ready to publish properly.

## Current status (as of 2026-07-08)

`pnpm run build:apk` (see §"Shortcut" below) correctly runs env var setup → `expo prebuild` → `gradlew assembleRelease` in sequence, and the sync-related `.env` config is confirmed loading correctly during prebuild. However, the build itself still fails on this machine with a **Windows path-length problem**, not a project bug:

```
CMake Warning: The object file directory [...] has 223-245 characters. The maximum full path
to an object file is 250 characters (see CMAKE_OBJECT_PATH_MAX). [...]
ninja: error: manifest 'build.ninja' still dirty after 100 tries
BUILD FAILED
```

**Root cause:** the repo's path (`C:\PROJECTS\Mobile\expense-tracker\`) combined with pnpm's nested dependency layout (`node_modules\.pnpm\react-native-worklets@0.5.1_<hash>\node_modules\react-native-worklets\...`) pushes CMake's native-build object file paths for modules like `react-native-worklets`, `react-native-screens`, and `expo-modules-core` past its internal 250-character limit. Windows' own long-path support is already enabled on this machine (`LongPathsEnabled=1` in the registry) and doesn't help, since CMake enforces its own conservative limit for portability, independent of the OS.

**Important: `subst` (temporary drive-letter mapping) does NOT fix this**, despite initially looking like the obvious fix — this was tried and confirmed not to work. pnpm's `node_modules/.pnpm/...` structure uses NTFS junctions that store the *real* absolute target path internally; when CMake resolves a path through a `subst`'d drive letter, the junction still resolves back to the real (long) underlying path, so nothing is actually shortened where it matters. Worse, mixing a `subst` alias with tools that resolve to the real path elsewhere (Gradle's JS-bundling step hit this) causes a *different* failure: `"this and base files have different roots"`.

**The actual fix: physically relocate the project to a shorter real path** (e.g. `C:\dev\expense-tracker\`), not an alias. This is disruptive (changes your real working directory; any open editors/terminals need to be pointed at the new location) and was not completed as of this writing — attempting it hit file locks from a running editor (VS Code) holding the directory open, and a subsequent move/copy attempt was interrupted mid-operation and needs careful manual reconciliation before it's safe to retry. If you're picking this back up: verify the current location and integrity of the project (`git status`, `git log`) before running any further move/copy commands, and prefer a plain OS-level move (Windows Explorer cut-and-paste, or `Move-Item` in a single command with no other tool/editor holding the folder open) over `robocopy /MOVE`, which deletes source files incrementally as it copies and leaves things in a genuinely inconsistent state if interrupted.

**Alternative that avoids the whole path-length problem:** `eas build --platform android` (Expo's cloud build service) builds on Expo's Linux infrastructure instead of locally, sidestepping this Windows-specific issue entirely. Requires a free Expo account; see §7 below.

Everything from step 1 onward in this doc describes the intended local flow and is correct up through native module configuration — it just hasn't produced a completed APK on this machine yet, for the reasons above.

This project uses Expo's **managed workflow** (no `android/` folder is committed). To produce a native APK we generate that folder on demand (`expo prebuild`) and build it with Gradle directly. This is the standard "bare" escape hatch and is fully supported by Expo.

## Shortcut: one command for steps 3–4

Once the one-time setup in §1 is done (Android SDK/JDK installed, `.env` created), steps 3 and 4 below (prebuild + Gradle build, with the right env vars set) are chained into a single script:

```bash
cd "C:\PROJECTS\Mobile\expense-tracker\artifacts\expense-tracker"
pnpm run build:apk
```

This runs `scripts/build-apk.sh` (full path: `C:\PROJECTS\Mobile\expense-tracker\artifacts\expense-tracker\scripts\build-apk.sh`), which sets `ANDROID_HOME`/`JAVA_HOME`/`PATH` for just that run, then runs `expo prebuild` and `gradlew assembleRelease` in sequence. Output lands at the same path as always: `android\app\build\outputs\apk\release\app-release.apk`.

**Why a `.sh` file instead of one line directly in `package.json`:** `pnpm run` on this Windows machine spawns `cmd.exe` to execute script strings (confirmed by testing directly — not a guess), which doesn't understand `export`, `$VAR`, or `&&`-chained POSIX syntax. Wrapping everything in a `bash -c "..."` one-liner works in principle, but the Android Studio JDK path (`C:\Program Files\Android\Android Studio\jbr`) contains spaces, which forces enough nested quote-escaping between JSON, cmd.exe, and bash simultaneously that it becomes genuinely fragile (this was tried and broke on unrelated `(x86)`-style parentheses elsewhere in the system `PATH`). A dedicated `.sh` file sidesteps all of that — `package.json` just needs `bash scripts/build-apk.sh` as the script value, and cmd.exe only has to successfully launch `bash.exe` with a plain file path, no complex quoting involved.

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

The app's cloud-sync feature (§Priority 1 in `PRD_REVIEW_TASKS.md`) needs its own config, read from a `.env` file — **not** an OS-level environment variable, and unrelated to `ANDROID_HOME`/`JAVA_HOME`.

Full path: **`C:\PROJECTS\Mobile\expense-tracker\artifacts\expense-tracker\.env`**

This file is gitignored and must be created manually on each machine you build from. Copy the template and fill in real values:
```bash
cp "C:\PROJECTS\Mobile\expense-tracker\artifacts\expense-tracker\.env.example" "C:\PROJECTS\Mobile\expense-tracker\artifacts\expense-tracker\.env"
```
Then edit it to contain:
```
EXPO_PUBLIC_SYNC_SERVER_URL="https://folio-server-rmsl.vercel.app"
EXPO_PUBLIC_SYNC_API_KEY="<the real SYNC_API_KEY value, matching what's set in folio-server's Vercel project>"
```
Both must be prefixed `EXPO_PUBLIC_` — Expo's Metro bundler only inlines env vars with that exact prefix into the built JS bundle. This file is read automatically the moment you run `expo prebuild` (step 3 below) or `expo start` — nothing else needs to source it manually. If either variable is missing, the app still builds and runs fine; sync is just treated as unconfigured (a silent no-op, never a crash).

---

## 2. Install workspace dependencies

From the workspace root (`C:\PROJECTS\Mobile\expense-tracker`):
```bash
pnpm install
```
(If pnpm ever stops with `ERR_PNPM_IGNORED_BUILDS`, run `pnpm approve-builds --all` once and re-run install — this approves native postinstall scripts like esbuild's binary download, which is a pnpm supply-chain safety gate, not an error in the project.)

---

## 3. Generate the native Android project

From `artifacts/expense-tracker`:
```bash
pnpm exec expo prebuild --platform android --no-install
```

This creates an `android/` folder (gitignored by default via the app's `.gitignore`) containing a full native Gradle project derived from `app.json`. Re-run this command any time you change `app.json` (name, icon, package id, permissions, plugins) — it's safe to re-run; it regenerates the native project from scratch each time.

Notable config already set for you in `app.json`:
- `expo.android.package` — the Android application ID (`com.andyosei.folio` as of this writing). **This cannot be changed after you've installed the app on a device without uninstalling first** — Android treats a different package id as a different app.
- `expo.name` / `expo.slug` — display name and internal slug.

---

## 4. Build the release APK

From `artifacts/expense-tracker/android`:
```bash
./gradlew assembleRelease
```

First run will take several minutes (Gradle downloads its own toolchain + all native Android dependencies the first time; subsequent builds are much faster thanks to the Gradle cache). Output APK lands at:
```
artifacts/expense-tracker/android/app/build/outputs/apk/release/app-release.apk
```

### Troubleshooting: NDK auto-download stalls or fails

By default, `expo prebuild` configures the project to require the exact NDK/build-tools versions Expo's current SDK recommends (as of this build: NDK `27.1.12297006`, build-tools `36.0.0`). If those exact versions aren't already installed, Gradle tries to download them automatically via the SDK manager — and on a slow or flaky connection this can silently stall for a very long time (observed: stuck downloading the NDK with zero progress for 15+ minutes), or fail outright under `--offline`.

If you already have a *different* NDK/build-tools version installed (check with `ls "$ANDROID_HOME/ndk"` and `ls "$ANDROID_HOME/build-tools"`) and don't want to wait for a fresh ~1GB download, force Gradle to use what's already there by adding this to `artifacts/expense-tracker/android/build.gradle`, right after the `apply plugin: "expo-root-project"` line:
```groovy
ext {
  ndkVersion = "27.0.12077973"       // replace with your installed version
  buildToolsVersion = "36.1.0"       // replace with your installed version
}
```
**This edit is lost every time you re-run `expo prebuild`** (it regenerates `android/` from scratch), so you'll need to reapply it after every prebuild if you hit this again. Don't combine this with `--offline` — Gradle still needs a network round-trip to *verify* an already-installed SDK component even when no download is actually required, and `--offline` blocks that verification, causing a different failure ("NDK not configured").

### Troubleshooting: CMake object-path-length errors

See "Current status" at the top of this doc — this is the currently-unresolved blocker on this machine. Short version: shorten the real path the project lives at (not a `subst` alias, which doesn't help — see above), or use EAS Build instead (§7).

### About signing
Expo's generated template configures the `release` build type to sign with the same **debug keystore** (`android/app/debug.keystore`) that's used for development builds. This is intentional for local/manual builds — it produces a fully functional, installable release APK. It is **not** suitable for the Play Store (Play requires you to manage your own upload key), but for sideloading onto your own phone it's exactly what you want and requires zero extra setup.

If you'd rather build a debug APK instead (slightly larger, includes dev tooling, but never needs Metro/JS bundling changes to work standalone — actually `assembleRelease` already bundles JS in, so this is rarely necessary): `./gradlew assembleDebug`, output at `android/app/build/outputs/apk/debug/app-debug.apk`.

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
cd artifacts/expense-tracker/android
./gradlew assembleRelease
```
Gradle bundles the current JS into the APK automatically as part of `assembleRelease` (no separate Metro/bundle step needed, unlike Expo Go).

---

## 7. Later: moving to the Play Store

When you're ready for a Play Console account, you have two reasonable paths:
1. **EAS Build** (`eas build --platform android`) — Expo's cloud build service, handles a proper release keystore for you, produces an `.aab` (Play's required format) instead of an `.apk`. Requires a free Expo account.
2. **Stay local**: generate your own upload keystore with `keytool`, wire it into `android/app/build.gradle`'s `signingConfigs.release`, and run `./gradlew bundleRelease` to produce an `.aab`. More manual, but zero recurring cloud dependency.

Either way, the debug-keystore-signed APK described above is only for personal/manual distribution — Play Store submissions need a distinct signing key you control long-term (losing it means you can never update the app again under the same listing).
