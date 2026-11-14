#!/usr/bin/env bash
# Builds the Capacitor Android APK: Expo web export -> www/ -> native WebView shell.
set -euo pipefail
cd "$(dirname "$0")"
(cd ../.. && bun run export:web)
rm -rf www && cp -r ../../dist www
test -d android || npx cap add android
npx cap sync android
# the web game calls navigator.vibrate(); the WebView only allows it with this permission
grep -q android.permission.VIBRATE android/app/src/main/AndroidManifest.xml || sed -i '0,/<application/s//<uses-permission android:name="android.permission.VIBRATE" \/>\n    <application/' android/app/src/main/AndroidManifest.xml
# release build: R8 on, signed with the debug key so it installs directly
sed -i 's/minifyEnabled false/minifyEnabled true/' android/app/build.gradle
grep -q 'signingConfig signingConfigs.debug' android/app/build.gradle || \
  sed -i '0,/minifyEnabled true/s//minifyEnabled true\n            signingConfig signingConfigs.debug/' android/app/build.gradle
for n in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  for f in ic_launcher ic_launcher_round; do cp ../kotlin-compose/app/src/main/res/mipmap-$n/ic_launcher.png android/app/src/main/res/mipmap-$n/$f.png; done
done
rm -rf android/app/src/main/res/mipmap-anydpi-v26
(cd android && ./gradlew assembleRelease --no-daemon)
mkdir -p ../../out && cp android/app/build/outputs/apk/release/app-release.apk ../../out/capacitor-android.apk
