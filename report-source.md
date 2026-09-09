# ScoreFlow deep audit — research record

Canonical report: `docs/scoreflow-deep-audit.md`

Audience, date, scope, assumptions, current-state analysis, recommendations, implementation sequence, acceptance criteria, limitations, and source list are contained in the canonical report.

## Claim-to-source ledger

- Hidden score chrome, side tap zones, central reveal, page seek — forScore, “Basics,” accessed 2026-09-05, https://forscore.co/documentation/basics/.
- Per-score audio association, collapsible media box, stored playback adjustments, recorded page turns — forScore, “Audio,” accessed 2026-09-05, https://forscore.co/documentation/audio/.
- Contextual annotation and text tools — forScore, “Annotation,” accessed 2026-09-05, https://forscore.co/documentation/annotation/.
- Page and item bookmarks — forScore, “Bookmarks,” accessed 2026-09-05, https://forscore.co/documentation/bookmarks/.
- Score links and action buttons — forScore, “Links & Buttons,” accessed 2026-09-05, https://forscore.co/documentation/links-buttons/.
- Up-next, score flipping, gestures, page transitions, and appearance — forScore, “Settings,” accessed 2026-09-05, https://forscore.co/documentation/settings/.
- Draggable annotation toolbar, layers, parts, media, page division, performance mode — Newzik Support, accessed 2026-09-05, https://support.newzik.com/en/support/home.
- Adaptive layout versus simple resizing — Flutter, “Adaptive and responsive design,” updated 2026-05-05, https://docs.flutter.dev/ui/adaptive-responsive.
- Localized rebuilds and expensive rendering guidance — Flutter, “Performance best practices,” updated 2026-07-31, https://docs.flutter.dev/perf/best-practices.
- Profile/release performance testing — Flutter, “Performance profiling,” accessed 2026-09-05, https://docs.flutter.dev/perf/ui-performance.
- Adaptive Android navigation and secondary-action placement — Android Developers, “Layouts and navigation patterns,” updated 2026-06-17, https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns.
- Minimum touch targets and non-gesture alternatives — Android Accessibility Help and Android Developers, accessed 2026-09-05, https://support.google.com/accessibility/android/answer/7101858 and https://developer.android.com/design/ui/mobile/guides/foundations/accessibility.
- Accessible personalized color roles — Android Developers, Material 3 theming, accessed 2026-09-05, https://developer.android.com/codelabs/m3-design-theming.
- Background playback/session guidance — Android Developers, Media3, accessed 2026-09-05, https://developer.android.com/media/media3/session/background-playback.
- Playlist, indexed seeking, lazy loading, clipping, and loops — just_audio API, accessed 2026-09-05, https://pub.dev/documentation/just_audio/latest/.

## Evidence limitations

- Commercial-product claims are based on their publishers’ current feature documentation and are used as interaction precedents, not independent quality measurements.
- No student usability study, instrumented task timing, or on-device frame trace was available. Recommendations derived from source inspection should be validated with representative students and at least one low-end Android device.
- No source PDF or audio content was copied, analyzed, or redistributed for this audit.

## Search stop rationale

Research stopped after current implementation gaps were mapped to primary framework/platform guidance and multiple mature score-reader precedents. Additional general UI articles repeated the same patterns and were unlikely to change the recommended architecture.
