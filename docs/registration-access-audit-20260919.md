# Registration, recruitment, and music access — September 19, 2026

Source workspace: `C:\NDrive\BedfordRoadTheatre`. The Mountain Duck mount
examined earlier contained an older website and Android wrapper; findings from
that copy must not be assumed to describe the current Flutter release.

## Registration repairs

- Forward API timeout options instead of silently dropping them. Legacy API
  requests now have a default 30-second timeout; registration completion keeps
  its explicit 45-second timeout.
- Allow 65 seconds for the Firebase registration endpoint, whose server limit
  is 60 seconds, instead of abandoning it after 15 seconds. Network failures
  explain how to retry the saved request without choosing another username.
- Load production-area options when Register is opened, not on every sign-in
  visit. A live options request still took 4.573 seconds; this change avoids
  unnecessary work, rather than claiming that the spreadsheet became faster.
- Preserve a committed Firebase login if subsequent community synchronization
  fails. Previously, the catch block deleted that login even after saving its
  user/profile records.
- Prevent duplicate legacy mirror completion for the same user while allowing
  different students to finish in parallel, and repair missing profile/access rows on
  retry, instead of treating the existence of a user row as proof that every
  registration step completed.
- Verify Firebase passwords against the exact mirrored user ID when the legacy
  hash does not match. Firebase registrations intentionally store an unusable
  random password in the spreadsheet; the old login path could not reconnect
  those users to production web tools.
- A browser Firebase sign-in error no longer reports a completed registration
  as a failed account creation. Web tools can reconnect from the portal session.

## Music access investigation

Read-only live checks for `kekebirdy3` found:

- Firebase login enabled with the password provider;
- active application user and Student Participant permission group;
- two active department assignments;
- all 92 published tracks match the account's audience access.

No account permissions or password were changed. An expired native Firebase
token was previously returned indefinitely by the web tools. The website now
checks expiry and reconnects through the validated portal session when needed.
The password bridge repair also helps existing Android/iOS clients reconnect.

The account's exact on-device symptom was requested. Without that response or
an authenticated device reproduction, these are confirmed shared code defects,
not proof of the specific failure experienced on this student's device.

## Recruitment

Removed audition/interest navigation and the expired audition date from the
public homepage. The existing form URLs now require an administrator session;
their content is rendered only after private-page initialization. Both Firebase
and Apps Script require administrator authorization for configuration and
submissions. Admin → Auditions & Interest retains review data, scheduling, and
links to both forms. No submissions were deleted.

## Validation and deployment

- `npm run check`
- `node scripts/test-registration-access.mjs`: actual handler tests covering
  commit failures, secondary-sync failure, UID mismatch, disabled accounts,
  partial mirror recovery, timeout forwarding, expired native tokens, and
  anonymous/student rejection versus administrator recruitment access.
- Existing cutover-readiness and registration-concurrency scripts pass.
- Apps Script deployed as version 90.
- Firebase `registerStudent` and `recruitment` updates deployed successfully.
  Live anonymous checks reject recruitment configuration and both submission
  actions; registration still rejects invalid input before creating an account.
- Twelve changed website files published to Neocities. Live source comparisons
  passed for the homepage, login, forms, core API/auth scripts and service worker.
- The live Apps Script recruitment endpoint rejects anonymous requests with
  `AUTH_REQUIRED`; registration options remain available.

No test accounts were created. No APK/IPA was rebuilt; these changes are in the
shared website and backends. Physical Android/iOS acceptance remains untested.
The reviewed Apps Script files are retained under `backend/appsscript/` because
the complete deployment mirror is intentionally ignored by Git.
