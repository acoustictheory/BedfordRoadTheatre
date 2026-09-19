# Registration and access repair

These three files record the reviewed Apps Script changes from September 19,
2026. They are a partial snapshot, not a standalone Apps Script project.

The deployment source remains `.remote-appsscript-audit`, configured by
`.clasp.json`. Pull the live project before future edits and merge changes;
do not overwrite newer remote code with this snapshot. Other backend files
remain private and are not published to Neocities.

- `Auth.js`: verifies Firebase passwords when the mirrored legacy hash cannot
  match, prevents concurrent completion for the same user, and repairs missing profile/access
  records when a partial registration is retried.
- `FirebasePasswordLogin.js`: checks Firebase's password response against the
  exact legacy user ID. No password or authentication token is logged or stored.
- `Api.js`: requires administrator access for audition/interest configuration
  and submissions. Existing administrator review actions remain available.
