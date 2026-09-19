# Native profile editing — 2.17.0+64

The Account tab now opens a native **Edit profile** screen on Android and iOS.
It edits first/last/display name, pronouns, grade/role, biography, phone,
emergency contact and visibility. Theme Studio and department requests remain
native. Department approvals, account username and account email retain their
existing administrative controls.

Photos are selected using the platform picker (iOS requests a compatible image
representation), reduced to at most 1024 pixels on the longest edge without
stretching, encoded as PNG, and uploaded through the website's existing photo
endpoint. The original selection limit is 25 MB and prepared upload limit 5 MB.
Photo removal requires confirmation. Photo operations preserve unsaved text.

## Synchronization

- Native requests use fresh Firebase ID tokens and `portalData`; ownership is
  derived from the verified token. The client cannot choose another user.
- `updateProfile` accepts only self-editable fields and preserves omitted fields.
  A theme-only save therefore cannot erase contact or name fields.
- Profile and community display-name updates commit in one Firestore batch.
- Both theme clients now use the canonical profile located by its user field,
  rather than creating an unrelated document named after the authentication UID.
- The app account header observes community name/photo updates immediately.
- Failed saves retain edits; leaving with unsaved edits requires confirmation.
- No Firestore permissions were broadened. No real member profile was changed
  for testing.

## Validation and rollout

Validation: Flutter profile/API/widget/image tests plus schedule and annotation
regressions (13 tests), server field validation/allowlist tests, registration
regression script, frontend syntax checks, and Flutter analysis.

The shared `portalData` function was deployed successfully. A live unauthenticated
update was rejected with HTTP 403. Flutter analysis passed with existing info
lints and no warnings/errors.

Android release: `downloads/BedfordRoadMusical-2.17.0.apk`, build 64, published
and verified (91,889,567 bytes). The package is `ca.sk.bedfordroad.musical`; its
signing certificate matches the prior release. Local and public SHA-256:
`71b03ab92c240ab3c3988a2e74a09a27766710634aeb059c753c5b0486ef784f`.
The install page, website theme code, config and service worker were published
and verified byte-for-byte. Website release ID:
`bedford-frontend-20260919-profile-2170`.

iOS shares the implementation and includes a photo-library usage description.
The signed iOS build must run in Codemagic using `bedford-ios-testflight` on
`master`; this Windows environment cannot build/sign iOS and has no Codemagic
API credentials. Physical Android/iOS picker and end-to-end authenticated
profile saves still need device acceptance testing.
