# Native Music & Tracks / offline ScoreFlow — 2.18.0+65

## User experience

- More > Music & Tracks opens a Flutter audio player, not a web workspace.
  Search, Guide Vocal/Practice filters, play/pause, seeking, ten-second jumps,
  previous/next song, speed and repeat operate on installed audio.
- More > ScoreFlow opens the native score library. Every song also has a direct
  ScoreFlow button from Music & Tracks. Opening a score pauses the music player
  to prevent two unrelated players sounding together.
- All 92 currently published tracks (46 guide/practice pairs) and all 49
  production PDFs are included: 46 song scores, libretto, full script and full
  sheet music. Original media bytes are preserved; no audio recompression.
- The media payload is 613,921,202 bytes before APK/IPA compression. Files are
  opened locally as needed; there is no first-use website download. Large PDFs
  are stored in 16 MiB parts to bound memory during local extraction.
- Sign in online once and stay signed in to use the app offline. The shell
  caches the last successfully loaded portal for that Firebase UID. Offline
  and network-error fallback never substitutes another user's cached session;
  known disabled accounts and authorization failures do not use that fallback.
- Local annotations and playback maps no longer wait for the cloud before the
  reader opens. Annotation synchronization and optional new AutoTrack maps
  still use the network in the background. No published AutoTrack maps existed
  in this export, so automatic page following requires a subsequently
  published map; ordinary playback and manual score reading work offline.
- New or replaced website tracks require a new app/media release. This bundle
  is a reviewed snapshot, not an automatic runtime download of future tracks.

## Media integrity and release process

`scripts/bundle-production-media.mjs` is the developer-only Firebase export.
It uses the existing Firebase CLI login, refuses restricted tracks in a shared
build, verifies every source hash/size, and writes an allowlisted catalog plus
binary parts to `mobile-app/assets/offline/`. No credentials enter that catalog.

Runtime `OfflineMedia` reads only Flutter assets and the app-private filesystem.
It coalesces simultaneous opens, checks SHA-256 before publishing a file, and
recovers incomplete/corrupted extracted copies from the installed bundle. It
has no HTTP or Firebase dependency. Both native players use this repository.

Binary parts are ignored by Git. The small manifest is tracked. The immutable
Android release in the existing Firebase Storage project is also the media
source for clean Android/iOS builds. `downloads/android-release.json` pins its
URL, APK hash, catalog hash and counts. Codemagic runs the restoration script
before testing/building the IPA, so iOS includes identical media without
requiring Firebase credentials on the build server.

```powershell
python scripts/prepare-offline-media.py
python scripts/prepare-offline-media.py --verify
cd mobile-app
flutter test --no-pub
flutter analyze --no-pub --no-fatal-infos
flutter build apk --release --no-pub
```

After building, verify APK identity/signature, copy it to the versioned local
`downloads/` filename, and run:

```powershell
python scripts/prepare-offline-media.py --verify-apk mobile-app/build/app/outputs/flutter-apk/app-release.apk
node scripts/publish-android-release.mjs
```

The publisher verifies a complete anonymous download before writing the release
descriptor. The Neocities install page links to that verified Firebase-hosted
APK. The Neocities deploy script excludes externally hosted APK binaries.

## Validation

- All 92 MP3s parsed successfully (6,027 seconds combined, both variants).
- All 49 unencrypted PDFs opened successfully (439 pages combined).
- 19 Flutter tests cover existing profiles, schedules and annotations plus
  offline extraction, shared opens, cache corruption recovery, failed integrity
  checks and all guide/practice-to-score mappings.
- Flutter analysis passes with informational lints and no errors/warnings.
- Physical Android/iOS playback, audio interruption and airplane-mode acceptance
  still require device testing. No connected device or Codemagic credential is
  available in this Windows workspace; iOS distribution requires starting
  `bedford-ios-testflight` on `master` in Codemagic.

## Published Android artifact

Version 2.18.0, build 65; 575,357,763 bytes (548.7 MiB). SHA-256:
`9e126cce39fc59ab3ac402510b53f891b827435ac805b1af100f3ff89af0c13b`.
The signed package identity and certificate match the previous app. Every
bundled media part was verified inside the final APK. A complete anonymous
public download matched the local APK hash. A clean-directory restoration of
all media using the same script as Codemagic also passed verification.

The install page, release descriptor, Android QR, config and service worker
were published to Neocities and verified byte-for-byte after deployment.
