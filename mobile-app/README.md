# Bedford Road Musical mobile app

This Flutter project targets Android and iOS. The production iOS bundle ID is
`ca.sk.bedfordroad.musical`; the matching Firebase iOS app and
`ios/Runner/GoogleService-Info.plist` are configured.

The repository-root `codemagic.yaml` provides the
**Bedford Road Musical - iOS TestFlight** workflow. It builds on Codemagic's
hosted macOS/Xcode infrastructure, so the repository can be prepared and the
build launched entirely from Windows.

## What the cloud workflow does

The workflow uses a `mac_mini_m2`, the stable Flutter channel, the latest
available Xcode image, and default CocoaPods. From the `mobile-app` project it:

1. validates required secrets and iOS configuration files;
2. runs `flutter pub get`;
3. installs pods only if a Podfile exists (this project currently uses
   Flutter's Swift Package Manager integration);
4. runs `flutter analyze --no-fatal-infos` and any discovered Flutter tests;
5. asks App Store Connect for or creates App Store signing files, installs them
   in the temporary build keychain, and applies the provisioning profile;
6. selects one build number higher than the latest TestFlight build;
7. builds a signed release IPA and retains the IPA, XCArchive, dSYMs, and logs;
8. uploads the successful IPA to App Store Connect and submits it to TestFlight.

No automatic Git trigger is configured. A build starts only when you select
**Start new build** in Codemagic.

## One-time GitHub setup from Windows

This Git repository currently has no remote. Create a new **private** GitHub
repository without adding a README, license, or `.gitignore`. Then, from the
repository root (`C:\NDrive\BedfordRoadTheatre`), add its URL and push:

```powershell
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_PRIVATE_REPOSITORY.git
git push -u origin master
```

Using GitHub CLI instead is also safe if it is already authenticated:

```powershell
gh repo create YOUR_PRIVATE_REPOSITORY --private --source . --remote origin --push
```

Never commit an App Store Connect `.p8` key, Apple password, signing
certificate, or provisioning profile.

## Create the App Store Connect application

Apple Developer Program membership is required. In Apple Developer, ensure an
explicit App ID exists for `ca.sk.bedfordroad.musical` with Push Notifications
enabled. In App Store Connect, choose **My Apps > + > New App**, select iOS,
enter **Bedford Road Musical**, select that bundle ID, and provide a unique SKU.

After creation, open **General > App Information** and copy the numeric
**Apple ID**. This is the `APP_STORE_APPLE_ID` value used below.

## Create the App Store Connect API key

In App Store Connect open **Users and Access > Integrations > App Store Connect
API**, create a dedicated key named for Codemagic, and assign the **App Manager**
role. Record its Issuer ID and Key ID and download the `.p8` private key
immediately; Apple permits downloading it only once.

## Connect GitHub and credentials to Codemagic

1. Sign into Codemagic, choose **Add application**, connect GitHub, and select
   the private repository.
2. Select **Flutter App** and YAML configuration. Codemagic reads
   `codemagic.yaml` from the repository root; the workflow itself uses
   `mobile-app` as its working directory.
3. In the application or team settings, create an environment-variable group
   named exactly `appstore_credentials`.
4. Add these four variables to that group and mark every value **Secure**:

   - `APP_STORE_CONNECT_ISSUER_ID` — Issuer ID from App Store Connect.
   - `APP_STORE_CONNECT_KEY_IDENTIFIER` — the API Key ID.
   - `APP_STORE_CONNECT_PRIVATE_KEY` — the complete contents of the downloaded
     `.p8` file, including its BEGIN/END PRIVATE KEY lines.
   - `APP_STORE_APPLE_ID` — the app's numeric Apple ID from App Information.

The workflow uses those values for both automatic signing and publishing. It
fetches or creates the matching App Store distribution certificate and
provisioning profile at build time; no certificate or profile belongs in Git.

## Start the first TestFlight build

Commit and push this configuration, then open the application in Codemagic.
Choose **Start new build**, select the `master` branch and
**Bedford Road Musical - iOS TestFlight**, and start it. Downloadable IPA,
archive, dSYM, and build-log artifacts appear on the completed build page.

After upload, Apple processes the build. Find it in App Store Connect under
**My Apps > Bedford Road Musical > TestFlight**. Complete any missing beta app
information, compliance answers, and tester-group configuration there.

`ITSAppUsesNonExemptEncryption` is set to `false` because the app only uses
standard platform HTTPS/TLS and does not implement proprietary encryption.
Answer App Store Connect's export-compliance questions consistently with that
fact. Reassess this declaration if custom cryptography is ever added.

## Enable iOS push delivery in Firebase

The Xcode target includes the Push Notifications capability, a production APNs
entitlement, and background remote notifications. Apple credentials are still
required for delivery:

1. In Apple Developer open **Certificates, Identifiers & Profiles > Keys**.
2. Create or select a key with **Apple Push Notifications service (APNs)**,
   record its Key ID and Team ID, and download its `.p8` file.
3. In Firebase Console open **Project settings > Cloud Messaging**, locate the
   iOS app `ca.sk.bedfordroad.musical`, and upload the APNs authentication key
   with its Key ID and Team ID.

The APNs key may be separate from the App Store Connect API key. Do not add
either key to this repository.

## First-build validation

The first hosted build must confirm macOS-only integration and signing. After
installing the TestFlight build, verify on an iPhone or iPad:

- login and Firebase authentication;
- dashboard, communications, and notification permission;
- foreground and background push delivery;
- ScoreFlow PDF rendering and annotation;
- guide/practice audio download, playback, seeking, and background audio;
- document export and sharing;
- offline reopening of previously downloaded material.

No microphone permission is declared because the app does not capture audio;
its `PictureRecorder` usage is an in-memory graphics renderer for PDF export.
