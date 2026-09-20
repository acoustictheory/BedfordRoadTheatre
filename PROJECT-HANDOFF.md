# Bedford Road Theatre — project handoff and access log

Last updated: 2026-09-19
Workspace: `C:\NDrive\BedfordRoadTheatre`  
Git branch: `master`

This is the resume point for the Bedford Road Theatre production portal and
ScoreFlow mobile application. It intentionally contains account identifiers and
credential locations, but **no passwords, refresh tokens, API secrets, signing
keys, or private keys**.

## Current release and deployment state

- Website: <https://bedfordroadtheatre.ca>
- Neocities site: `bedfordroadtheatre`
- Android/ScoreFlow: `2.18.0+65`
- Current Android download: <https://bedfordroadtheatre.ca/install.html#android> (Firebase-hosted offline APK; pinned in `downloads/android-release.json`)
- iOS bundle ID: `ca.sk.bedfordroad.musical`
- iOS 2.18.0 Codemagic build `6aaf33d31c7c27da103a38d2` queued on 2026-09-19; completion and TestFlight availability remain unverified. See `docs/codemagic-access.md`.
- Firebase rules and Cloud Functions are deployed to `brpa-digital-hub-dev`.
- Current application release commit: `4f9153a` (committed and pushed to `origin/master`).
- Working tree should be clean when this document is committed.

## Resume here - latest session checkpoint

The requested implementation and Android publication are complete. This
checkpoint includes a queued iOS build and configured Codemagic API access.
The already verified Android release does not require rebuilding.

| Item | Confirmed state |
|---|---|
| Android | 2.18.0, build 65, published and downloadable from the install page |
| APK | `downloads/BedfordRoadMusical-2.18.0.apk` locally; 575,357,763 bytes / 548.7 MiB |
| APK SHA-256 | `9e126cce39fc59ab3ac402510b53f891b827435ac805b1af100f3ff89af0c13b` |
| Media | 92 MP3 tracks (46 guide/practice pairs), 49 PDFs, all included in the APK |
| Public delivery | Existing Firebase Storage bucket, object `app-releases/BedfordRoadMusical-2.18.0.apk`; URL and hashes in `downloads/android-release.json` |
| Website | Install page, current release descriptor, Android QR, config and service worker published and verified |
| Web cache ID | `bedford-frontend-20260919-offline-2180` |
| iOS | 2.18.0 build `6aaf33d31c7c27da103a38d2` queued through API; signed IPA and TestFlight publication not yet verified |
| Verification | 19 Flutter tests pass; analysis has no warnings/errors; APK identity/signature, all packaged media, public download hash and clean-directory media restoration pass |

Next work, when resuming:

1. Check queued Codemagic build `6aaf33d31c7c27da103a38d2` before starting
   another. API access is now configured; see `docs/codemagic-access.md` for
   encrypted credential location, status commands and future build requests.
   The workflow uses `appstore_credentials`. Confirm signing/upload and
   TestFlight processing; the accepted build request does not prove publication.
2. Perform physical Android/iOS acceptance: install/update, sign in online once,
   stay signed in, enable airplane mode and reopen the app. Try both audio
   variants, seeking/speed/repeat, a song score and a full PDF in ScoreFlow.
   Check guide/practice switching, interruptions/backgrounding, and annotations
   reconnecting after returning online. These checks have not been performed.
3. Check native profile/photo changes against the website and confirm schedule
   times match the correct website times on both platforms.
4. If `kekebirdy3` still reports a problem, obtain the actual device symptom and
   reproduce it. The account/track-access audit passed; that individual's
   successful on-device playback has not been confirmed. Music & Tracks now
   opens natively and uses included files rather than the website session.

Completed changes carried into 2.18.0:

- Registration failure/timeout and legacy password/session bridge fixes;
  Apps Script version 90 and Firebase registration/recruitment fixes deployed.
- Audition and interest forms removed from public navigation and restricted to
  administrators. Admin review remains available; submissions were preserved.
- Shared Android/iOS schedule formatting uses Saskatchewan (`America/Regina`)
  time. The correct website schedule and stored event times were not changed.
- Native profile details, photo upload/removal, department requests and theme
  editing use shared website data. Username/account email remain admin-managed.
- Native Music & Tracks and ScoreFlow include all current tracks and production
  PDFs. Future track additions/replacements require another media/app release.

Detailed evidence: `docs/registration-access-audit-20260919.md`,
`docs/schedule-timezone-fix.md`, `docs/native-profile-editor.md`, and
`docs/offline-music-release.md`. Older release versions/test counts in those
individual historical audits describe their original releases, not the latest
Android version above.

Recent important application commits:

- `4f9153a` - native Music & Tracks, bundled offline audio/scores, Android 2.18.0.
- `2c06570` - native profile/photo editing and website synchronization, 2.17.0.
- `227718b` - verified Android 2.16.3 schedule release.
- `27c2c91` - shared Saskatchewan schedule-time fix.
- `1955c54` - registration/access fixes and administrator-only recruitment.

## Offline native music release (2.18.0)

Music & Tracks and ScoreFlow are native. All 92 tracks and all 49 production
PDFs are included in the installer. Sign in online once; music and scores then
open without website downloads. See `docs/offline-music-release.md`.

Before building a clean checkout, run `python scripts/prepare-offline-media.py`
from the root. Codemagic restores and verifies the same bundled media before
building iOS. Large binary parts remain outside Git; the manifest is tracked.
The large APK is hosted in the existing Firebase Storage bucket and linked
from Neocities. `scripts/publish-android-release.mjs` uploads and verifies it;
`downloads/android-release.json` records its exact download and hashes.

## Native profile editing (2.17.0)

Account > Edit profile is a native Flutter form for the same editable profile
fields as the website. Photo selection, resizing, upload/removal, department
requests and Theme Studio stay in the app. All changes use the existing
Firebase portalData service and canonical profile; community display names and
photos update too. Username/account email remain account metadata, not editable
profile fields. See `docs/native-profile-editor.md` for validation and rollout.

## What the project includes

### Public and authenticated website

The root HTML files plus `assets/` form the Neocities website. It includes:

- login, registration, profile and production dashboard;
- announcements, schedules, tasks, resources and production directory;
- rehearsal tracks and production-document library;
- ScoreFlow/libretto launch and Android installation pages;
- recruitment, audition booking and musical-interest forms;
- communications;
- administration, permissions and managed accounts;
- props, scenic, costume and blocking workspaces.

Deploy with:

```powershell
npm run check
npm run deploy:neocities
```

The deploy script publishes public files and the current release descriptor.
The offline APK is hosted separately in Firebase Storage.

### ScoreFlow Flutter application

Source: `mobile-app/`

The same Flutter source builds Android and iOS. It includes authenticated
production access, offline score/libretto reading, audio tracks, page navigation,
AutoTrack, layered annotations, PDF export, communications and production tools.

ScoreFlow annotation schema v5 stores each mark as a separate Firestore document
under:

```text
productions/{productionId}/scoreAnnotations/{ownerId}_{documentId}/marks/{markId}
```

Active production members may view other singers' annotations. Only the owner or
a Full Administrator may modify them. Old device/cloud annotation formats remain
readable and migrate on the next successful save. See
`docs/scoreflow-annotation-cloud-audit.md`.

Android build:

```powershell
python scripts/prepare-offline-media.py
cd mobile-app
flutter test
flutter build apk --release
```

Copy the release APK to `downloads/BedfordRoadMusical-{version}.apk`, run
`node scripts/publish-android-release.mjs`, update the install link from the
verified release descriptor, bump the service-worker `BUILD_ID`, then deploy
Neocities.

### Firebase backend

- Firebase project ID: `brpa-digital-hub-dev`
- Project display name observed in CLI: `Bedford Performing Arts DEV`
- Project number: `499470162310`
- Auth domain: `brpa-digital-hub-dev.firebaseapp.com`
- Storage bucket: `brpa-digital-hub-dev.firebasestorage.app`
- Functions region: `northamerica-northeast2`
- Default project alias is recorded in `.firebaserc`.

Firebase provides Authentication, Firestore, Storage, Cloud Functions and
messaging. Rules live in `firestore.rules` and `storage.rules`; functions live in
`functions/index.js`.

Common deployments:

```powershell
firebase deploy --only firestore:rules --project brpa-digital-hub-dev
firebase deploy --only storage --project brpa-digital-hub-dev
$env:FUNCTIONS_DISCOVERY_TIMEOUT='60'
firebase deploy --only functions --project brpa-digital-hub-dev
```

### Google Apps Script and legacy spreadsheet

Apps Script remains the legacy database/API bridge while Firebase-native paths
are used for the faster mobile and web features.

- Script ID: `1WXpceUZJOfGTYaChIbwR0L1NIB8hlryA1O6j5WrNEESdrktuFnMs94at`
- Local Apps Script mirror: `.remote-appsscript-audit/`
- `.clasp.json` points `clasp` at that mirror.
- Live web-app deployment ID:
  `AKfycbw2hM9wqpgvlRlQVEUr-h19GpTeXoVe3fwZb2CsR0bjIDdi9idHEEUtgLPne0YJ0HtHMQ`
- Current deployment version at handoff: `90`
- Master spreadsheet ID:
  `1Qbj_-F6rsn6PYhEnE4sda7XK8REKVPMPxquQIiEv4PU`
- Public API URL is recorded in `assets/config.js`.

Before editing Apps Script, pull the current source to avoid overwriting a newer
remote edit:

```powershell
clasp pull
```

After reviewed changes:

```powershell
clasp push --force
clasp deploy -i AKfycbw2hM9wqpgvlRlQVEUr-h19GpTeXoVe3fwZb2CsR0bjIDdi9idHEEUtgLPne0YJ0HtHMQ -d "Description"
```

## Developer/service account logins

| Service | Account or identity | Login method and local credential location |
|---|---|---|
| Firebase CLI / Google Cloud | `laj@spsd.sk.ca` | Interactive `firebase login`; cached by Firebase CLI under the Windows user profile. Check with `firebase login:list`. Never commit that cache. |
| Google Apps Script / clasp | `laj@spsd.sk.ca` | Interactive `clasp login`; OAuth tokens are in `C:\Users\justi\.clasprc.json`. Never commit this file. |
| GitHub repository | GitHub owner/account `acoustictheory`; repository `BedfordRoadTheatre` | Remote: `https://github.com/acoustictheory/BedfordRoadTheatre.git`. Authentication is handled by the machine's Git credential mechanism; no GitHub token is stored in this repository. |
| Git commit identity | `Justin La <jcncpt92@gmail.com>` | Local Git configuration. This is commit attribution and may differ from the account used to authenticate a push. |
| Neocities | Site name `bedfordroadtheatre`; account email not exposed by the API | API key is in the ignored root file `.neocities-api-key`. Re-authenticate/generate a key in the Neocities dashboard if missing. Never commit the key. |
| Codemagic | Account email not stored locally—verify in the Codemagic dashboard | API token encrypted outside Git at `%LOCALAPPDATA%\BedfordRoadTheatre\codemagic-token.dpapi`; see `docs/codemagic-access.md`. Workflow `bedford-ios-testflight`; signing group `appstore_credentials`. |
| Apple App Store Connect | Account email/team not stored locally—verify in App Store Connect/Codemagic | Codemagic variables: `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_IDENTIFIER`, and `APP_STORE_CONNECT_PRIVATE_KEY`. Do not place their values in Git. |

## Application user login model

This is separate from the developer/service accounts above.

- Students sign in with a production username and password.
- Firebase Authentication represents usernames as synthetic emails:
  `{username}@users.bedford-musical.invalid`.
- Users do not enter or receive that synthetic email; the app converts the
  username internally.
- Firebase user IDs use stable `USR-...` identifiers and are mirrored in
  Firestore `users` and `profiles` records.
- Firebase ID tokens include/resolve the legacy user identity so Firebase and
  Apps Script refer to the same person.
- Apps Script also mirrors registered users for legacy pages. Firebase-native
  registrations intentionally do not store the student's usable Firebase
  password in the legacy spreadsheet.
- Full Administrator status comes from the user's account record. Never infer
  administrator status from the profile or annotation owner being viewed.
- Registration currently uses the active production and an administrator-created
  registration code. The tested fake account “John Dover” was deleted completely
  after testing and its registration-code use was restored.

## iOS/TestFlight handoff

Workflow: `bedford-ios-testflight` in `codemagic.yaml`.

The workflow:

1. verifies App Store Connect environment variables and iOS configuration;
2. installs Flutter/CocoaPods dependencies and restores/verifies bundled media
   through `scripts/prepare-offline-media.py`;
3. runs `flutter analyze --no-fatal-infos` and Flutter tests;
4. applies the App Store provisioning profile;
5. assigns a unique build number;
6. builds a signed IPA;
7. uploads to TestFlight, but not directly to the public App Store.

Required Codemagic environment group: `appstore_credentials`. Required bundle
identifier: `ca.sk.bedfordroad.musical`. Builds can now be queued and checked
through the API from this workstation; see `docs/codemagic-access.md`. Check
the existing queued build before starting another. Signing runs on Codemagic,
not locally on Windows.

## Local secrets and files that must remain private

- `%LOCALAPPDATA%\BedfordRoadTheatre\codemagic-token.dpapi`
- `.neocities-api-key`
- `C:\Users\justi\.clasprc.json`
- `C:\Users\justi\.config\configstore\firebase-tools.json`
- any Firebase Auth exports under `migration-exports/`
- signing certificates, provisioning profiles and App Store Connect private keys
- any backup containing user profiles, password hashes, salts, sessions or tokens

The public Firebase web API key in `assets/config.js` identifies the Firebase
project; authorization is enforced by Firebase Authentication and security
rules. It is not a replacement for the private credentials listed above.

## Resume checklist

```powershell
Set-Location C:\NDrive\BedfordRoadTheatre
git status --short
git pull --ff-only origin master
firebase login:list
node scripts/deploy-neocities.mjs --check
npm run check
```

For a clean checkout that will be built, restore the existing media with
`python scripts/prepare-offline-media.py`. Do not re-export live Firebase media
for an ordinary rebuild: the published APK and checked-in manifest already
provide the verified bundle. Re-export only when intentionally preparing a new
media snapshot. Preserve the existing Android signing identity so updates
install over the current app.

Then verify:

- `mobile-app/pubspec.yaml` contains the intended app version;
- website download links use that same version;
- `service-worker.js` has a new `BUILD_ID` for every public web release;
- Firebase/Apps Script account identity is correct before deployment;
- the Codemagic iOS workflow has access to `appstore_credentials`;
- no secret or private backup appears in `git status`.

## Known operational notes

- Flutter on this workstation: `C:\Users\justi\develop\flutter\bin\flutter.bat`.
- Local raw media/export reports and the clean-build restoration check are in
  ignored `backups/` folders. These are development artifacts, not website or
  Git content. `backups/offline-ci-smoke/` remains from the successful restore
  check; automatic review blocked an optional recursive-cleanup command.
- APK binaries and `mobile-app/assets/offline/*.bin` are ignored. The catalog
  and release descriptor are tracked with LF line endings because their bytes
  are checksum-pinned across Windows and macOS builds.

- Neocities/browser service-worker caching can make an old release label appear.
  Update the install page, all APK references and `BUILD_ID`, then redeploy.
- Firestore Standard rejects nested arrays. ScoreFlow v5 avoids them by storing
  each annotation mark as its own document.
- Firestore rules tests require Java 21. This workstation has JDK 21 at
  `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`.
- The Google OAuth project used by `clasp` currently has the direct Google Sheets
  API disabled. Spreadsheet maintenance should normally use Apps Script rather
  than attempting direct Sheets API calls from local scripts.
- Preserve unrelated changes in a dirty worktree and never commit credential
  caches, API keys, Auth exports or private migration backups.
