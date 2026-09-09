# Bedford Road Musical Android shell

The Android release is a Trusted Web Activity (TWA). The APK contains the app identity and trusted origin; the live application is served from `https://bedfordroadtheatre.ca` and retains its service-worker, API snapshot, image, and downloaded-audio storage.

## Proposed permanent identity

- App name: `Bedford Road Musical`
- Package ID: `ca.sk.bedfordroad.musical`
- Host: `bedfordroadtheatre.ca`
- Start path: `/communications.html?source=installed`

Confirm the package ID before generating the permanent signing key. Changing either the package ID or signing key later prevents an APK from updating the installed app.

## Build stages

1. Publish the new manifest, PNG icons, service worker, and storage page to Neocities.
2. Confirm `https://bedfordroadtheatre.ca/manifest.webmanifest` exposes the new Android-ready manifest.
3. Run `npm run android:doctor`.
4. Use the official Bubblewrap CLI in this directory to initialize from the live manifest:

   ```powershell
   npx @bubblewrap/cli@1.25.0 init --manifest=https://bedfordroadtheatre.ca/manifest.webmanifest
   ```

5. The permanent release keystore is stored at `C:\Users\justi\.bubblewrap\keys\bedford-road-musical-release.jks` with its local credential record in the same directory. Never commit either file.
6. Digital Asset Links is published at `/.well-known/assetlinks.json` on Neocities with the release certificate fingerprint.
7. The signed version 1.0.0 APK is generated in `releases/` and published under the immutable filename `downloads/BedfordRoadMusical-1.0.0-build1.apk`.
8. Test the APK on a physical Android phone before broad student distribution.

Bubblewrap is intentionally not installed as a project dependency. Version 1.25.0 currently brings vulnerable transitive build dependencies into `npm audit`; invoking the pinned official CLI only for the isolated Android build keeps the website dependency tree clean. Review the CLI version and its audit again before producing another release.

## Release invariants

- Reuse the same signing key forever.
- Increase Android `versionCode` for each shell update.
- Keep the package ID unchanged.
- Ordinary website changes do not require a new APK.
- Keep at least two encrypted backups of the signing key and credential record.
