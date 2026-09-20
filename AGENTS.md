# Start here

Read `PROJECT-HANDOFF.md` before continuing work. It records the current
published build, completed fixes, validation, deployment locations and the
remaining iOS/device acceptance work. The working repository is
`C:\NDrive\BedfordRoadTheatre`; an older Mountain Duck mount is not the current
source checkout.

For the native/offline app, also read `docs/offline-music-release.md` and
`mobile-app/README.md`. Use `mobile-app/pubspec.yaml` and
`downloads/android-release.json` as the version/artifact references. Bundled
binary media is intentionally outside Git; restore it with
`python scripts/prepare-offline-media.py` before building a clean checkout.

Keep credentials and private account backups out of documentation and Git.
The handoff lists credential locations, not their contents.
