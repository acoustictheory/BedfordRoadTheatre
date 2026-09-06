# Bedford Road Theatre mobile app

This Flutter project builds the Bedford Road Theatre Android and iOS app. The
production application ID and iOS bundle ID are both
`ca.sk.bedfordroad.musical`. iOS builds run on Codemagic's hosted Mac; a local
Mac or physical iPhone is not required to create and upload the IPA.

## Current release configuration

- App version: `2.9.12+35`
- iOS deployment target: 15.0
- Firebase iOS configuration: `ios/Runner/GoogleService-Info.plist`
- APNs entitlement: production
- Background modes: audio and remote notifications
- Export compliance: `ITSAppUsesNonExemptEncryption` is `false`
- Codemagic workflow: `bedford-ios-testflight` in the repository-root
  `codemagic.yaml`

The app does not capture microphone input, so it intentionally has no
`NSMicrophoneUsageDescription`. Add that description before introducing any
recording feature.

## Windows to GitHub

From `C:\NDrive\BedfordRoadTheatre`, verify and push the prepared commit:

```powershell
git status
git push origin master
```

The remote is `https://github.com/acoustictheory/BedfordRoadTheatre.git`.
Never commit `.p8`, `.p12`, `.mobileprovision`, Apple passwords, or API keys.

## Register the Apple application

1. In Apple Developer, open **Certificates, Identifiers & Profiles >
   Identifiers** and create an explicit App ID for
   `ca.sk.bedfordroad.musical`.
2. Enable **Push Notifications** on that identifier.
3. In App Store Connect, open **My Apps > + > New App**.
4. Choose iOS, enter **Bedford Road Theatre**, select the registered bundle ID,
   and enter a unique SKU.

The App Store Connect app record must exist before Codemagic can upload an IPA.

## Connect GitHub and Codemagic

1. In Codemagic choose **Add application**, connect GitHub, and select
   `acoustictheory/BedfordRoadTheatre`.
2. Select repository YAML configuration. `codemagic.yaml` is at the repository
   root and sets `working_directory: mobile-app`.
3. Select the `master` branch and use **Check for configuration file** if the
   workflow is not displayed immediately.

## Add the App Store Connect API key

1. In App Store Connect open **Users and Access > Integrations > App Store
   Connect API**.
2. Generate a dedicated key with the **App Manager** role.
3. Record the Issuer ID and Key ID and download the `.p8` immediately. Apple
   permits only one download.
4. In Codemagic create the environment-variable group
   `appstore_credentials`.
5. Add these variables and mark all three **Secure**:

   - `APP_STORE_CONNECT_ISSUER_ID`
   - `APP_STORE_CONNECT_KEY_IDENTIFIER`
   - `APP_STORE_CONNECT_PRIVATE_KEY` — paste the complete `.p8` contents,
     including the BEGIN/END lines

These variables authenticate TestFlight publishing. They never belong in Git.

## Configure Codemagic signing identities

The YAML uses Codemagic's current `ios_signing` configuration for an
`app_store` distribution and `ca.sk.bedfordroad.musical`.

1. In **Team settings > Team integrations > Developer Portal**, add the same
   App Store Connect API key.
2. In **codemagic.yaml settings > Code signing identities > iOS
   certificates**, generate or fetch an **Apple Distribution** certificate
   using that key.
3. In **iOS provisioning profiles**, fetch or create an **App Store** profile
   for `ca.sk.bedfordroad.musical`.
4. Confirm Codemagic shows a matching certificate for the profile. If Push
   Notifications was enabled after the profile was created, regenerate or
   refetch the profile.

Codemagic automatically attaches matching identities because the workflow
declares `distribution_type: app_store` and the exact bundle identifier. The
`xcode-project use-profiles` step applies them to Runner.

## Start the first TestFlight build

1. Open the Bedford Road Theatre app in Codemagic.
2. Choose **Start new build**.
3. Select branch `master` and workflow **Bedford Road Theatre - iOS
   TestFlight**.
4. Start the build.

The workflow verifies the iOS configuration, restores Flutter packages,
installs CocoaPods when applicable, analyzes the Dart code, runs tests when
present, applies signing, assigns a unique CI build number, builds the signed
IPA, and uploads it to TestFlight. IPA, XCArchive, dSYM, and build logs are
retained as artifacts.

Apple processing can take several minutes. Find the build in **App Store
Connect > My Apps > Bedford Road Theatre > TestFlight**. Complete beta app
information and tester groups there. For export compliance, the current app
uses standard platform HTTPS/TLS and declares no non-exempt encryption; answer
consistently unless custom cryptography is later added.

## Enable iOS push delivery

1. In Apple Developer open **Certificates, Identifiers & Profiles > Keys**.
2. Create or select a key with **Apple Push Notifications service (APNs)**.
3. Record its Key ID and Team ID and download its `.p8`.
4. In Firebase Console open **Project settings > Cloud Messaging**, select the
   iOS app `ca.sk.bedfordroad.musical`, and upload the APNs key with its Key ID
   and Team ID.

The APNs key and App Store Connect key serve different purposes and may be
separate keys. Neither should be committed.

## TestFlight acceptance checks

After installing from TestFlight, verify Firebase login, notification
permission and foreground/background pushes, ScoreFlow PDF rendering and
annotation, rehearsal-track download/playback/seeking/background audio,
sharing/export, and offline reopening of downloaded material.
