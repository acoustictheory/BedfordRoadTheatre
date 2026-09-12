# Bedford Road Theatre — project handoff and access log

Last updated: 2026-09-11  
Workspace: `C:\NDrive\BedfordRoadTheatre`  
Git branch: `master`

This is the resume point for the Bedford Road Theatre production portal and
ScoreFlow mobile application. It intentionally contains account identifiers and
credential locations, but **no passwords, refresh tokens, API secrets, signing
keys, or private keys**.

## Current release and deployment state

- Website: <https://bedfordroadtheatre.ca>
- Neocities site: `bedfordroadtheatre`
- Android/ScoreFlow: `2.16.2+62`
- Current APK: <https://bedfordroadtheatre.ca/downloads/BedfordRoadMusical-2.16.2.apk>
- iOS bundle ID: `ca.sk.bedfordroad.musical`
- iOS 2.16.2 source is ready for the next Codemagic/TestFlight build.
- Firebase rules and Cloud Functions are deployed to `brpa-digital-hub-dev`.
- Latest application commit before this handoff document: `d8c45ca`
- Working tree should be clean when this document is committed.

Recent important commits:

- `d8c45ca` — installation page and cache updated to ScoreFlow 2.16.2
- `da34a6c` — repaired ScoreFlow annotation cloud synchronization
- `634d3c4` — complete user-record cleanup on deletion
- `c4f055d` — repaired permissions for newly registered students
- `3c6e753` — repaired invalid task date handling

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

The deploy script publishes public files and only the APK matching the version
in `mobile-app/pubspec.yaml`.

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
cd mobile-app
flutter test
flutter build apk --release
```

Copy the release APK to `downloads/BedfordRoadMusical-{version}.apk`, update any
website version references, bump the service-worker `BUILD_ID`, then deploy
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
- Current deployment version at handoff: `88`
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
| Codemagic | Account email not stored locally—verify in the Codemagic dashboard | GitHub-connected workflow `bedford-ios-testflight` in `codemagic.yaml`. App Store credentials come from Codemagic environment group `appstore_credentials`. |
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
2. installs Flutter/CocoaPods dependencies;
3. runs `flutter analyze --no-fatal-infos` and Flutter tests;
4. applies the App Store provisioning profile;
5. assigns a unique build number;
6. builds a signed IPA;
7. uploads to TestFlight, but not directly to the public App Store.

Required Codemagic environment group: `appstore_credentials`. Required bundle
identifier: `ca.sk.bedfordroad.musical`. Start the next build manually in
Codemagic after confirming the GitHub commit and branch. A signed iOS binary
cannot be built on this Windows workstation.

## Local secrets and files that must remain private

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

Then verify:

- `mobile-app/pubspec.yaml` contains the intended app version;
- website download links use that same version;
- `service-worker.js` has a new `BUILD_ID` for every public web release;
- Firebase/Apps Script account identity is correct before deployment;
- the Codemagic iOS workflow has access to `appstore_credentials`;
- no secret or private backup appears in `git status`.

## Known operational notes

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
