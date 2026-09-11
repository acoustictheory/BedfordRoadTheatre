# ScoreFlow annotation cloud-save audit

Date: 2026-09-10

## Finding

Version 2.16.1 writes one page document containing a `marks` array. Each mark
contains a `points` array, producing `marks[] -> mark -> points[]`. Firestore
Standard rejects that nested-array shape before security rules are evaluated.
Changing coordinate pairs from arrays to maps did not remove the outer/inner
array nesting.

Because the invalid payload is constructed by the installed Flutter client and
sent directly to Firestore, rules or backend deployment cannot transform it.
A replacement Android/iOS binary is required.

## Corrected schema (v5)

```
productions/{productionId}/scoreAnnotations/{ownerId}_{documentId}
  ownerUserId, documentId, schemaVersion, markCount, pageNumbers, updatedAt
  marks/{markId}
    id, page, points:[{x,y}], kind, color, widthFactor, opacity,
    stamp, text, layerId, scale, rotation, lastEditedBy, updatedAt
```

Each mark is now a separate document, so its `points` field is a top-level
array rather than an array nested inside another array. This also avoids an
ever-growing page document and isolates concurrent edits to individual marks.
Writes remain serialized on device and are committed in batches of at most 400
operations.

## Compatibility and migration

- Device-local v4 annotations remain readable and use the same preferences key.
- v5 reads mark documents first, then falls back to v4 page shards and the
  original parent-document format.
- The first successful v5 save writes mark documents and removes legacy page
  shards.
- Realtime listeners use the mark subcollection, enabling cross-device updates.

## Access model

- Active production members may view another singer's annotation copy.
- Only the annotation owner or a full administrator may create, change, or
  delete marks.
- Administrator status is determined from the signed-in account, not from the
  singer whose annotations are being reviewed.
- The app disables annotation mode for another singer's copy unless the viewer
  is a full administrator.

## Verification

- Dart serialization and legacy coordinate migration tests pass.
- Firestore rules compile and pass emulator tests for owner writes, member
  reads, rejected non-owner writes, and administrator access.
- The emulator accepted a v5 mark containing a top-level array of point maps.
- Android release 2.16.2 built successfully.
