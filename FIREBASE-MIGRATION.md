# Bedford Musical Firebase migration

## Source backup

The authoritative pre-migration export is stored privately in Google Drive under
`99 Archives/Bedford Firebase Migration 20260903-223002`.

- Export folder ID: `1YroiJY4PYFQutlvf489HjCyzIW9nYTuF`
- Source spreadsheet ID: `1Qbj_-F6rsn6PYhEnE4sda7XK8REKVPMPxquQIiEv4PU`
- Firebase project: `brpa-digital-hub-dev`
- Exported sheets: 72
- Exported rows: 2,035
- Exported accounts: 33
- Referenced Drive files copied: 101
- Missing Drive files: 0
- Sessions intentionally excluded: yes

The folder contains JSON and CSV exports, a Drive file map, validation report,
redacted Script Properties, and a sensitive Firebase Authentication import file.
Do not put the authentication folder in the website, Git, email, or shared storage.

## Username authentication mapping

The visible login remains a username. The client normalizes it exactly as the
current portal does, then authenticates internally as:

`normalized-username@users.bedford-musical.invalid`

Current `UserID` values are retained as Firebase Authentication UIDs and
Firestore user document IDs.

## Password import parameters

The source portal hashes passwords as `SHA256(salt + "|" + password)`. The
The v3 Auth import converts hexadecimal hashes to Base64 and encodes the
existing salt plus its literal `|` delimiter as the Firebase salt. Use
`firebase-auth-import-v3-use-this.json`; do not use the older files. V3 also
excludes source timestamps that Firebase Auth does not accept during import.

```powershell
firebase auth:import firebase-auth-import-v3-use-this.json `
  --project brpa-digital-hub-dev `
  --hash-algo SHA256 `
  --rounds 1 `
  --hash-input-order SALT_FIRST
```

Do not run the complete Auth import until a controlled test account has
successfully signed in with its current password.

### Controlled account test

1. Download `firebase-auth-import-v2-use-this.json` from the private Drive
   archive into the ignored local `migration-exports` directory.
2. Extract one account without exposing its hash in the terminal:

```powershell
node scripts/prepare-firebase-auth-test.mjs `
  migration-exports/firebase-auth-import-v2-use-this.json `
  YOUR_USERNAME
```

3. Import only that account:

```powershell
firebase auth:import migration-exports/firebase-auth-test-one-user.json `
  --project brpa-digital-hub-dev `
  --hash-algo SHA256 `
  --rounds 1 `
  --hash-input-order SALT_FIRST
```

4. Test Firebase sign-in using the synthetic identifier printed by the helper
   and the administrator's current password. Never type that password into a
   command argument or save it in a script.

## Known source-schema warning

The live `Announcements` sheet contains duplicate `ActionURL`, `DeadlineAt`, and
`Location` headers created by an older repair routine. The CSV export preserves
every physical column. Future JSON exports disambiguate repeated names with a
`__duplicate_N` suffix. The Firestore importer must consolidate each pair into
one canonical field after comparing their values.

## Production promotion

Run `npm run firebase:promote` to promote the validated source into the
normalized model. Production records live below `productions/{productionId}`;
accounts, profiles, departments, permission definitions, and settings use root
collections. Fields are lower camel case and JSON columns become structured values.

The `users` collection deliberately excludes `passwordHash` and `passwordSalt`.
Passwords are held only by Firebase Authentication. Active members may read
production data and their own account record; production writes remain
administrator-only during the incremental client cutover.

The website currently uses shadow/dual authentication: Apps Script remains the
authoritative page API, and successful login also establishes Firebase Auth.
A Firebase/CDN failure is logged but does not lock students out of the portal.

## Storage migration

The 101 referenced Drive assets were copied to the private default bucket under
`legacy-drive/{sourceDriveFileId}/{fileName}`. The transfer validated each
object by source byte length and destination MD5, then independently recounted
101 objects / 250,706,302 bytes. Firestore `storageAssets` documents map every
legacy Drive ID to its verified Storage path and checksum. The temporary Apps
Script transfer bridge was removed in deployed version 70.

Authenticated members can read migrated assets; only imported full
administrators can write them. The track player prefers Firebase Storage and
keeps the Apps Script audio proxy as a fallback during cutover.
