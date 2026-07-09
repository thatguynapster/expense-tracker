#!/usr/bin/env bash
# Builds a local, installable release APK end to end:
#   1. Sets ANDROID_HOME / JAVA_HOME / PATH for this run only.
#   2. Regenerates the native android/ project from app.json (expo prebuild).
#   3. Builds the release APK with Gradle.
#
# See docs/LOCAL_APK_BUILD.md (workspace root) for the full explanation and
# one-time machine setup. Run via: pnpm run build:apk

set -euo pipefail

export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

echo "ANDROID_HOME=$ANDROID_HOME"
echo "JAVA_HOME=$JAVA_HOME"

echo "==> Regenerating native android/ project (expo prebuild)..."
pnpm exec expo prebuild --platform android --no-install

echo "==> Building release APK (gradlew assembleRelease)..."
cd android
./gradlew assembleRelease

echo
echo "Build complete:"
echo "  android/app/build/outputs/apk/release/app-release.apk"
