# ScoreFlow: transformational product and UX audit

**Audience:** Bedford Road Musical product owner and development team  
**Date:** September 5, 2026  
**Scope:** Android ScoreFlow experience, with implications for the shared website track library  
**Decision:** how to transform ScoreFlow from a PDF reader with attached audio into a polished musical-rehearsal workspace

## Executive answer

ScoreFlow should stop behaving like a document page that happens to have a player and become a **continuous rehearsal cockpit**. The score remains almost full-screen; a compact “rehearsal ribbon” identifies the song and lets the student move backward, forward, or jump anywhere; a draggable mini-player changes between Guide, Practice, Instrumental, Voice Part, or other available versions without leaving the score; and annotation becomes a small contextual tool dock that expands only when needed.

The transformation is not primarily about adding more controls. It is about giving every control a clear layer:

1. **Always available:** song identity, previous/next song, play/pause, progress.
2. **One gesture away:** track version, jump-to-song, loop, speed, bookmarks, page mode.
3. **Contextual:** annotation tools, colors, layers, selected-mark editing.
4. **Hidden until requested:** advanced settings, downloads, diagnostics, destructive actions.

That hierarchy would make ScoreFlow feel calmer *and* substantially more capable.

## What ScoreFlow is today

The present implementation already has meaningful foundations:

- protected PDF caching in app-private storage;
- page-anchored vector annotations;
- pen, highlighter, selector, lasso, eraser, line, arrow, rectangle, ellipse, text, music symbols, layers, undo, and redo;
- continuous, page, fit-width, and fit-page commands;
- linked rehearsal tracks, play/pause, ±10 seconds, playback speed, and A–B looping;
- a collapsible bottom player;
- local reading-position persistence;
- a theme system inherited from the user profile.

The problem is not lack of raw functionality. It is **fragmentation**. The viewer, audio player, song library, annotation studio, and theme system feel like adjacent components instead of one coherent instrument.

### Current high-impact weaknesses

| Area | Current behavior | Why it underperforms |
|---|---|---|
| Song navigation | The reader opens one `ProductionDocument`; there is no score queue or previous/next song action. | A student must back out, find another song, and reopen the reader—the opposite of rehearsal flow. |
| Track variants | A dropdown exposes matches for the current score. | It does not communicate a stable family such as Guide / Practice / Instrumental / Part, and it lacks the richer paired-track experience already present on the website. |
| Annotation entry | A large extended “Annotate” floating button sits over the score. | It claims valuable score area even when the user is only reading. |
| Annotation tools | A 62-pixel horizontal strip appears above the document with every tool. | It moves the score, creates icon overload, and makes common tools compete with rare tools. |
| Reader modes | The menu changes a string and issues zoom/navigation commands, but does not define truly distinct PDF page-layout behaviors. | “Page Turn” risks feeling like continuous scroll with arrow buttons instead of a deliberate reading mode. |
| Playback state | Page, position, and speed are partly saved; track choice and loop state are not coherently persisted. Track selection can also reset the displayed position. | Returning to rehearsal does not reliably restore the complete working context. |
| Loading and errors | Track discovery failures are silently swallowed. | “No track assigned” can actually mean permissions, mapping, network, or data errors, leaving users and admins unable to diagnose it. |
| Data model | The production identifier and song documents are hard-coded. | Annual productions and revised song lists will require code changes and can drift from Firestore. |
| Visual system | The library uses conventional cards; the reader mostly uses neutral surfaces even when a colorful profile theme exists. | ScoreFlow looks generic and disconnected from the expressive app around it. |
| Architecture | One large stateful reader owns PDF, playback, download, persistence, loops, and annotation. | Audio-position updates can rebuild too much UI and make future features harder to test and optimize. |

## The proposed experience: “ScoreFlow Stage”

### 1. A score-first screen

On entry, the PDF should occupy nearly the entire display. Controls appear as translucent, theme-colored glass surfaces at the top and bottom, then fade away after a short idle period. A center tap restores them. forScore uses a similar score-first principle: controls hide by default, the sides turn pages, and a central tap reveals navigation; it also provides a bottom page seek control for fast movement ([forScore Basics](https://forscore.co/documentation/basics/)).

The default state should show only:

- a narrow top **song ribbon**;
- a compact bottom **Now Rehearsing** player;
- the score;
- a tiny annotation pencil in the ribbon—not a floating extended button.

When controls hide, the score becomes genuinely full-screen. Keep a subtle two-pixel theme glow at the screen edge so the experience retains personality without tinting or reducing the readability of licensed music.

### 2. The song ribbon

Replace the generic app bar with:

`‹  04 · Rotten to the Core  ∨  4 of 23  ›`

- Previous and next are 48dp touch targets.
- Tapping the title opens **Jump to Song**.
- A small colored state dot communicates downloaded, downloading, online-only, or unavailable.
- A long press on previous/next opens the neighboring-song preview.
- At the end of a score, an optional second next-tap moves into the next song.

This mirrors the useful “up next” and flip-between-scores concepts offered by dedicated music readers, while remaining specific to Bedford’s ordered show book ([forScore Settings](https://forscore.co/documentation/settings/)).

### 3. Jump to Song as a rehearsal command palette

This should be a near-full-height sheet with:

- a search field focused immediately;
- ordered song number, title, thumbnail, and status;
- section chips: Opening / Act I / Act II / Finale / Bows, when metadata exists;
- filters: My numbers, Full company, Featured, Recently opened, Downloaded;
- a “continue” marker showing saved page and time;
- swipe preview or long-press preview without closing the current score.

Selecting a song performs a controlled transition: save current state, prefetch the next PDF page and preferred audio, crossfade the interface color, then reveal the new score. It must not recreate the entire portal shell.

### 4. One integrated track family

The player should understand a **song**, not independent MP3 rows. Each song can have variants:

- Guide Vocal
- Practice / accompaniment
- Instrumental
- Full Cast
- Soprano / Alto / Tenor / Bass or character-specific parts
- Dance break / rehearsal edit
- Pit reference

The expanded player places a segmented track-family selector immediately under the song title. If only two matched versions exist, use a **Guide ↔ Practice blend fader**, preserving the strongest interaction already on the website. If three or more exist, use horizontally scrollable, color-coded chips plus an optional mixer sheet. Never display empty variants.

Switching versions should preserve the current timestamp, loop, speed, and play state. A guide/practice change should feel instantaneous—not like loading a new page. `just_audio` already supports playlists, index seeking, clips, looping, and lazy preparation, so the needed queue and A–B architecture are supported by the existing playback library ([just_audio API](https://pub.dev/documentation/just_audio/latest/)).

### 5. A genuinely excellent compact player

#### Collapsed: 58–68dp

- track-family color rail;
- play/pause;
- title + active variant;
- thin tappable waveform/progress bar;
- loop-active indicator;
- next-song button;
- drag handle.

#### Half-expanded

- waveform with draggable playhead;
- rewind 10, play/pause, forward 10;
- previous/next song;
- variant chips or blend fader;
- A and B handles directly on the waveform;
- speed chip.

#### Full rehearsal drawer

- all variants;
- named saved loops (“Dance break,” “Measure 42 entrance”);
- queue / jump-to-song;
- offline status and download controls;
- bookmarks and rehearsal notes tied to time + page.

forScore associates audio with a score, saves playback adjustments per score, uses a draggable bottom media panel, and can record page turns against playback ([forScore Audio](https://forscore.co/documentation/audio/)). ScoreFlow should adapt that model with Bedford’s guide/practice variants and student-friendly naming.

### 6. Annotation without obstruction

Remove the extended floating button. Replace it with a compact pencil in the top ribbon and support a configurable long press on the score.

When activated, show a **floating tool dock** no taller than 48–52dp:

- initially: Pen, Highlighter, Eraser, Select, Undo, More;
- tap More or swipe the dock: Lasso, Line, Arrow, Shapes, Text, Music Symbols, Layers;
- tap an active tool again: its color, width, opacity, smoothing, and stylus settings;
- when marks are selected: replace the dock with Move, Resize, Rotate, Duplicate, Recolor, Layer, Delete;
- allow the dock to snap to top, bottom, left, or right and remember its position per orientation;
- include an eye icon for “hide ink temporarily” during rehearsal.

Newzik explicitly treats a draggable annotation toolbar and layers as central score-view features ([Newzik support](https://support.newzik.com/en/support/home)); forScore similarly separates common annotation actions from contextual selection and text editing ([forScore Annotation](https://forscore.co/documentation/annotation/)). The key lesson is not visual imitation—it is that tools should follow the user’s current task.

### 7. Annotation tools worth adding

- **Favorites rail:** pin the five tools/symbols each user uses most.
- **Recent colors and symbols:** one-tap reuse.
- **Pressure-aware ink and smoothing:** where stylus hardware supports it.
- **Palm rejection / stylus-only mode:** prominent, not buried.
- **Precision loupe:** for moving a mark or repeat link.
- **Measure bracket and rehearsal box presets.**
- **Music symbol search:** `crescendo`, `cut`, `breath`, `fermata`, `sharp`, etc.
- **Layer lock:** visible but not editable.
- **Layer opacity:** particularly useful for director notes.
- **Per-layer visibility presets:** Personal / Rehearsal / Director / Clean Score.
- **Autosave state indicator:** Saved / Saving / Offline, with no manual-save anxiety.
- **Annotation navigator:** thumbnail grid, filters by layer/tool/color, and next/previous annotated page.

Later, add **rehearsal links**: a tappable source marker can jump to a coda, repeat, another page, or another song. Dedicated readers use links to handle non-linear score navigation and can attach actions to page buttons ([forScore Links & Buttons](https://forscore.co/documentation/links-buttons/)). For a musical, this could also jump from a scene cue in the libretto to a song score.

### 8. Real reading modes

ScoreFlow should offer four real modes, each with its own layout implementation:

1. **Page Turn:** one fitted page; tap left/right edge; animated slide or subtle paper turn.
2. **Continuous:** smooth vertical reading with inertial scroll.
3. **Half Page:** advances by roughly half a page so the next system appears before the current one disappears.
4. **Two Page / Spread:** landscape tablets and foldables, advancing one or two pages by preference.

Add optional:

- crop margins per document;
- page dimming without altering ink contrast;
- portrait/landscape preference per document;
- keep screen awake during active rehearsal;
- Bluetooth pedal and keyboard actions;
- a screen-lock mode that prevents accidental zoom or navigation.

Flutter’s guidance distinguishes merely fitting content from choosing layouts and inputs appropriate to the available space; ScoreFlow should use a compact phone layout, a medium foldable/landscape layout, and a wide tablet layout rather than stretching one arrangement ([Flutter adaptive design](https://docs.flutter.dev/ui/adaptive-responsive)).

### 9. A colorful visual identity that does not fight the music

The PDF must remain visually neutral. Put expression in the **frame**, not over the notation.

#### “Showlight” visual language

- Each song receives a two- or three-color gradient derived from the user’s theme plus a stable song accent.
- The top ribbon and player share that gradient, creating one continuous frame.
- Active track variants have distinct accent identities: Guide = magenta, Practice = cyan, Instrumental = amber, Part = violet, while preserving labels and icons so color is never the only signal.
- Controls use tinted glass surfaces with strong contrast, thin luminous edges, and restrained shadows.
- Play/pause is the visual anchor; secondary transport controls are quieter.
- Song changes use a 220–280ms color wash and directional slide.
- Loop activation animates a small band across the waveform; it does not flash the whole screen.
- Annotation colors remain independent of the UI theme so marks stay predictable.

Material 3’s color roles explicitly support primary, secondary, and tertiary accents, and its tonal-palette approach is designed to preserve contrast even with personalized color ([Material 3 theming](https://developer.android.com/codelabs/m3-design-theming), [Material 3 color guidance](https://developer.android.com/develop/ui/compose/designsystems/material3)). Use the synchronized website/app theme as the seed, then derive safe tonal roles instead of applying raw user colors everywhere.

#### Built-in aesthetic packs

- **Descendants Neon:** electric magenta, poison apple green, deep navy.
- **Royal Blue:** sapphire, gold, parchment.
- **Auradon Day:** sky, aqua, warm white.
- **Villain Night:** violet, crimson, charcoal.
- **Stage Blackout:** low-light black, muted violet, amber cues.
- **Custom:** existing cross-platform theme, with an optional ScoreFlow intensity slider.

The current theme system is usable infrastructure; the reader simply needs ScoreFlow-specific semantic tokens such as `readerChrome`, `playerAccent`, `waveformPlayed`, `annotationDock`, and `pageSurround`.

### 10. A better library before opening the reader

Turn the plain document list into a **Rehearsal Library**:

- Continue Rehearsing hero card with cover art, song, page, track, and time;
- My Numbers carousel based on casting/ensemble membership;
- Full Show ordered list;
- Libretto and Full Score collection;
- Downloaded / needs download state;
- new or revised badge;
- last practiced indicator;
- admin-defined rehearsal setlists.

Bookmarks should be first-class rehearsal objects: a page, page range, audio timestamp, loop, variant, and note. Item-style bookmarks are valuable because they make a span of a larger book behave like its own piece with its own metadata and audio ([forScore Bookmarks](https://forscore.co/documentation/bookmarks/)). This is especially relevant if Descendants remains a single large score or libretto.

## Reliability and performance transformation

### Unify the domain model

Create a Firestore-backed `ScoreFlowSong` manifest:

```text
productionId
songId / songNumber / title / act / order
scoreDocumentId / pageStart / pageEnd / revision
trackVariants[] { id, family, role, storagePath, duration, revision }
castTags[] / departmentTags[]
themeAccent / artworkPath
```

The app should load this manifest once, cache it locally, and derive library, queue, score, track variants, and download state from it. Remove the hard-coded production ID and hand-authored document list.

### One durable rehearsal state

Persist atomically per user + production + song:

```text
page, zoom, readerMode, trackVariant, position,
speed, loopA, loopB, playerExpansion,
annotationDockPosition, visibleLayerPreset, updatedAt
```

Switching track variants preserves position and playing state. Switching songs writes the old state first and restores the new state before painting interactive controls.

### Prefetch intelligently

- Cache current score + preferred track.
- When idle on Wi-Fi, prepare the next song’s first PDF pages and audio metadata.
- Do not eagerly decode every PDF or retain full-page textures.
- Use a small bounded audio object cache and a disk cache keyed by revision.
- Show playable progress: allow audio to begin as soon as a valid local/streaming source is ready.
- Preload adjacent playlist entries lazily.

Flutter recommends minimizing expensive work in `build`, localizing rebuilds, and profiling frame performance rather than relying on intuition ([Flutter performance practices](https://docs.flutter.dev/perf/best-practices), [Flutter performance profiling](https://docs.flutter.dev/perf/ui-performance)). Split the current reader into independently updating score, player, annotation, and chrome widgets so an audio position tick never rebuilds the PDF viewer.

### Background and hardware playback

Add a single app-wide audio session so playback can continue under a locked screen when policy permits, with notification controls, headset/Bluetooth controls, proper interruption handling, and resume. Android recommends `MediaSessionService` for background playback and system media controls ([Android Media3 background playback](https://developer.android.com/media/media3/session/background-playback)).

### Honest failure states

Replace the silent track-load catch with specific states:

- No track linked to this song.
- Track metadata is still syncing.
- You do not have permission.
- Offline—download this track once when connected.
- File missing or unsupported; report to administrator.

For admins, include a compact diagnostic drawer showing score ID, linked track IDs, cache revision, and last error—without exposing storage download URLs to students.

## Accessibility and rehearsal safety

- All interactive targets at least 48×48dp with spacing; Android explicitly recommends this minimum ([Android touch-target guidance](https://support.google.com/accessibility/android/answer/7101858)).
- Every gesture has a visible/button or accessibility action equivalent; Android advises against gesture-only flows ([Android accessibility guidance](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility)).
- Screen-reader labels announce tool, active state, page, song, track variant, and loop state.
- Do not encode Guide/Practice or download state by color alone.
- Respect reduced motion and large text without covering the score.
- Provide high-contrast and low-light rehearsal modes.
- Confirm destructive annotation actions and provide undo.
- Optional haptics: page turn, loop boundary placement, successful mark selection.

## Recommended screen composition

```text
┌─────────────────────────────────────────┐
│ ‹  04 · Rotten to the Core  ▾  4/23  › │  Song ribbon
├─────────────────────────────────────────┤
│                                         │
│                                         │
│               SCORE                     │  Full canvas
│                                         │
│        tap edges to turn pages          │
│                                         │
│   [Pen][Highlight][Erase][Select][•••]  │  Only in annotation mode
├─────────────────────────────────────────┤
│ ▶  Guide Vocal     1:24 ━━━━━ 3:52  ⌃  │  Collapsible player
└─────────────────────────────────────────┘
```

Center tap hides/shows ribbon and player. Swipe player upward for variants, waveform, loop, and queue. Tap title for Jump to Song. The arrangement keeps every frequent action reachable with one hand while protecting the score canvas.

## Feature priority

### Release A — “Flow” (highest value)

1. Data-driven ordered song queue.
2. Previous / next / Jump to Song inside ScoreFlow.
3. Track-family selector with Guide / Practice / Instrumental / Part and timestamp-preserving switches.
4. Replace the annotation FAB with compact ribbon action and contextual dock.
5. True tap-edge page mode plus center-tap chrome.
6. Persist complete rehearsal state.
7. Specific loading/error states.

This release addresses the user’s principal pain without destabilizing annotation storage.

### Release B — “Showlight”

1. ScoreFlow semantic color tokens and aesthetic packs.
2. Gradient song ribbon and integrated glass player.
3. Waveform, draggable loop handles, named loops.
4. Rehearsal Library and Continue Rehearsing.
5. Favorites/recent annotation tools and dock positioning.
6. Half-page and two-page layouts.

### Release C — “Company rehearsal”

1. Admin setlists and My Numbers.
2. Bookmarks joining page + time + loop + track.
3. Director/shared layer synchronization with permissions and version history.
4. Rehearsal links and cue buttons.
5. Bluetooth pedal / keyboard shortcuts.
6. Page-turn recording synchronized to track playback.
7. Background media session and playback resumption.

### Later, only after evidence of need

- Optical music recognition;
- automatic score-following;
- pitch analysis;
- complex multi-track stem mixing.

These are expensive and are not necessary to deliver a dramatic improvement to Bedford’s actual rehearsal workflow.

## Acceptance criteria

The redesign is successful when:

- a student can change song in **one action** without leaving ScoreFlow;
- a student can switch Guide to Practice while playing with **no intentional position loss**;
- standard reading exposes at least **90% of the usable screen height** to the score when chrome is hidden;
- entering annotation takes one action, and the resting dock covers less than **8% of compact-screen height**;
- a returning user restores song, page, audio time, variant, speed, and loop;
- every primary control passes a 48dp target audit and remains operable without gestures;
- cached current/next songs open predictably offline;
- page turns and ink remain smooth in release/profile testing on the oldest supported school device;
- no track-mapping error is silently represented as “no track assigned.”

## Final recommendation

Build Release A as a cohesive redesign, not as isolated buttons added to the current app bar. The centerpiece should be a new `ScoreFlowSessionController` backed by a production song manifest and an ordered queue. Place the score, player, annotations, and theme around that session. Once the underlying rehearsal state is unified, the vivid Showlight aesthetic can be added safely and will feel structural rather than decorative.

ScoreFlow’s strongest possible identity is not “our PDF reader.” It is **the place where a Bedford performer opens a number and everything required to rehearse it—music, score, marks, loops, versions, and what comes next—is already there.**

## Sources consulted

- forScore, [Basics](https://forscore.co/documentation/basics/), accessed September 5, 2026.
- forScore, [Audio](https://forscore.co/documentation/audio/), accessed September 5, 2026.
- forScore, [Annotation](https://forscore.co/documentation/annotation/), accessed September 5, 2026.
- forScore, [Bookmarks](https://forscore.co/documentation/bookmarks/), accessed September 5, 2026.
- forScore, [Links & Buttons](https://forscore.co/documentation/links-buttons/), accessed September 5, 2026.
- forScore, [Settings](https://forscore.co/documentation/settings/), accessed September 5, 2026.
- Newzik, [Digital sheet music for musicians, ensembles, and schools](https://newzik.com/en), accessed September 5, 2026.
- Newzik Support, [Support home and feature guide index](https://support.newzik.com/en/support/home), accessed September 5, 2026.
- Flutter, [Adaptive and responsive design](https://docs.flutter.dev/ui/adaptive-responsive), updated May 5, 2026.
- Flutter, [Performance best practices](https://docs.flutter.dev/perf/best-practices), updated July 31, 2026.
- Flutter, [Performance profiling](https://docs.flutter.dev/perf/ui-performance), accessed September 5, 2026.
- Android Developers, [Layouts and navigation patterns](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns), updated June 17, 2026.
- Android Developers, [Accessibility](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility), accessed September 5, 2026.
- Android Accessibility Help, [Touch target size](https://support.google.com/accessibility/android/answer/7101858), accessed September 5, 2026.
- Android Developers, [Material 3 design theming](https://developer.android.com/codelabs/m3-design-theming), accessed September 5, 2026.
- Android Developers, [Background playback with a MediaSessionService](https://developer.android.com/media/media3/session/background-playback), accessed September 5, 2026.
- just_audio, [Dart API documentation](https://pub.dev/documentation/just_audio/latest/), accessed September 5, 2026.
- pdfrx, [Flutter PDF viewer documentation](https://github.com/espresso3389/pdfrx/blob/master/doc/README.md), accessed September 5, 2026.

