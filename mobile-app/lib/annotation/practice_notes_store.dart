import 'dart:convert';
import 'dart:ui';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ScoreAnnotationLayerDefinition {
  const ScoreAnnotationLayerDefinition({
    required this.id,
    required this.name,
    this.builtIn = false,
  });

  final String id;
  final String name;
  final bool builtIn;

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'builtIn': builtIn};

  factory ScoreAnnotationLayerDefinition.fromJson(Map<String, dynamic> json) =>
      ScoreAnnotationLayerDefinition(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? 'Layer',
        builtIn: json['builtIn'] as bool? ?? false,
      );
}

const defaultScoreAnnotationLayers = <ScoreAnnotationLayerDefinition>[
  ScoreAnnotationLayerDefinition(
    id: 'my_notes',
    name: 'My Notes',
    builtIn: true,
  ),
  ScoreAnnotationLayerDefinition(
    id: 'rehearsal',
    name: 'Rehearsal Notes',
    builtIn: true,
  ),
  ScoreAnnotationLayerDefinition(
    id: 'shared',
    name: 'Shared / Director',
    builtIn: true,
  ),
];

enum ScoreInkTool {
  navigate,
  pen,
  highlighter,
  eraser,
  stamp,
  line,
  arrow,
  rectangle,
  ellipse,
  text,
  move,
  lasso,
}

enum ScoreMarkKind {
  stroke,
  highlighter,
  line,
  arrow,
  rectangle,
  ellipse,
  stamp,
  text,
}

class ScoreInkMark {
  const ScoreInkMark({
    required this.id,
    required this.page,
    required this.points,
    required this.colorValue,
    required this.widthFactor,
    required this.opacity,
    required this.kind,
    this.stamp,
    this.text,
    this.layerId = 'my_notes',
    this.scale = 1,
    this.rotation = 0,
  });

  final String id;
  final int page;
  final List<Offset> points;
  final int colorValue;

  /// Stroke width expressed as a fraction of the PDF page width. Keeping this
  /// in page coordinates is what makes the ink grow/shrink with the score.
  final double widthFactor;
  final double opacity;
  final ScoreMarkKind kind;
  final String? stamp;
  final String? text;
  final String layerId;

  /// Visual scale for text / stamp annotations. Existing marks migrate to 1.0.
  final double scale;

  /// Clockwise rotation in radians for text / stamp annotations.
  final double rotation;

  ScoreInkMark copyWith({
    String? id,
    int? page,
    List<Offset>? points,
    int? colorValue,
    double? widthFactor,
    double? opacity,
    ScoreMarkKind? kind,
    String? stamp,
    String? text,
    String? layerId,
    double? scale,
    double? rotation,
  }) => ScoreInkMark(
    id: id ?? this.id,
    page: page ?? this.page,
    points: points ?? this.points,
    colorValue: colorValue ?? this.colorValue,
    widthFactor: widthFactor ?? this.widthFactor,
    opacity: opacity ?? this.opacity,
    kind: kind ?? this.kind,
    stamp: stamp ?? this.stamp,
    text: text ?? this.text,
    layerId: layerId ?? this.layerId,
    scale: scale ?? this.scale,
    rotation: rotation ?? this.rotation,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'page': page,
    'points': points.map((p) => [p.dx, p.dy]).toList(),
    'color': colorValue,
    'widthFactor': widthFactor,
    'opacity': opacity,
    'kind': kind.name,
    'stamp': stamp,
    'text': text,
    'layerId': layerId,
    'scale': scale,
    'rotation': rotation,
  };

  factory ScoreInkMark.fromJson(Map<String, dynamic> json) {
    final rawPoints = ((json['points'] as List?) ?? const [])
        .whereType<List>()
        .where((p) => p.length >= 2)
        .map((p) => Offset((p[0] as num).toDouble(), (p[1] as num).toDouble()))
        .toList();
    const maximumLoadedPoints = 1600;
    final stride = rawPoints.length > maximumLoadedPoints
        ? (rawPoints.length / maximumLoadedPoints).ceil()
        : 1;
    final parsedPoints = stride == 1
        ? rawPoints
        : <Offset>[
            for (var index = 0; index < rawPoints.length; index += stride)
              rawPoints[index],
            if (rawPoints.isNotEmpty &&
                rawPoints.length > 1 &&
                rawPoints.last !=
                    rawPoints[(rawPoints.length - 1) ~/ stride * stride])
              rawPoints.last,
          ];

    final legacyStampRaw = json['stamp'] as String?;
    final legacyStamp = legacyStampRaw == 'BREATH' ? ',' : legacyStampRaw;
    final kindName = json['kind'] as String?;
    final kind = ScoreMarkKind.values.firstWhere(
      (e) => e.name == kindName,
      orElse: () {
        if (legacyStamp != null && legacyStamp.isNotEmpty)
          return ScoreMarkKind.stamp;
        final legacyOpacity = (json['opacity'] as num?)?.toDouble() ?? 1;
        return legacyOpacity < .6
            ? ScoreMarkKind.highlighter
            : ScoreMarkKind.stroke;
      },
    );

    // v0.6 stored stroke widths in viewport pixels (3.5 / 18). Migrate those
    // marks to page-relative widths so they remain anchored at any zoom level.
    final widthFactor =
        (json['widthFactor'] as num?)?.toDouble() ??
        (((json['width'] as num?)?.toDouble() ??
                (kind == ScoreMarkKind.highlighter ? 18 : 3.5)) /
            800.0);

    return ScoreInkMark(
      id:
          json['id'] as String? ??
          DateTime.now().microsecondsSinceEpoch.toString(),
      page: (json['page'] as num?)?.toInt() ?? 1,
      points: parsedPoints,
      colorValue: (json['color'] as num?)?.toInt() ?? 0xFFE52BC9,
      widthFactor: widthFactor.clamp(.0005, .08).toDouble(),
      opacity: (json['opacity'] as num?)?.toDouble() ?? 1,
      kind: kind,
      stamp: legacyStamp,
      text: json['text'] as String?,
      layerId: json['layerId'] as String? ?? 'my_notes',
      scale: ((json['scale'] as num?)?.toDouble() ?? 1)
          .clamp(.35, 4)
          .toDouble(),
      rotation: (json['rotation'] as num?)?.toDouble() ?? 0,
    );
  }
}

class PracticeBookmark {
  const PracticeBookmark({
    required this.id,
    required this.label,
    required this.page,
    required this.positionMs,
    required this.track,
    required this.speed,
    required this.balance,
    required this.loopAMs,
    required this.loopBMs,
    required this.createdAt,
  });

  final String id;
  final String label;
  final int page;
  final int positionMs;
  final String track;
  final double speed;
  final double balance;
  final int? loopAMs;
  final int? loopBMs;
  final String createdAt;

  Map<String, dynamic> toJson() => {
    'id': id,
    'label': label,
    'page': page,
    'positionMs': positionMs,
    'track': track,
    'speed': speed,
    'balance': balance,
    'loopAMs': loopAMs,
    'loopBMs': loopBMs,
    'createdAt': createdAt,
  };

  factory PracticeBookmark.fromJson(Map<String, dynamic> json) =>
      PracticeBookmark(
        id: json['id'] as String? ?? '',
        label: json['label'] as String? ?? 'Practice spot',
        page: (json['page'] as num?)?.toInt() ?? 1,
        positionMs: (json['positionMs'] as num?)?.toInt() ?? 0,
        track: json['track'] as String? ?? '',
        speed: (json['speed'] as num?)?.toDouble() ?? 1,
        balance: (json['balance'] as num?)?.toDouble() ?? 0,
        loopAMs: (json['loopAMs'] as num?)?.toInt(),
        loopBMs: (json['loopBMs'] as num?)?.toInt(),
        createdAt: json['createdAt'] as String? ?? '',
      );
}

class PracticeNotesStore {
  PracticeNotesStore(
    this.songId, {
    required this.productionId,
    this.ownerUserId,
  });

  final int songId;
  final String productionId;
  final String? ownerUserId;
  final SharedPreferencesAsync _prefs = SharedPreferencesAsync();
  String get owner =>
      ownerUserId ?? FirebaseAuth.instance.currentUser?.uid ?? 'local';
  String get prefix => 'practice.$owner.$songId';
  DocumentReference<Map<String, dynamic>>? get cloud {
    if (owner == 'local' || productionId.isEmpty) return null;
    return FirebaseFirestore.instance
        .collection('productions/$productionId/scoreAnnotations')
        .doc('${owner}_$songId');
  }

  Future<List<ScoreInkMark>> loadInk() async {
    var text = await _prefs.getString('$prefix.ink.v2');
    if (text == null && ownerUserId == null) {
      text = await _prefs.getString('practice.$songId.ink.v2');
    }
    text ??= await _prefs.getString('practice.$songId.ink.v1');
    try {
      final snapshot = await cloud?.get();
      final remote = snapshot?.data()?['marks'] as List?;
      if (remote != null) {
        text = jsonEncode(remote);
        await _prefs.setString('$prefix.ink.v2', text);
      }
    } catch (_) {}
    if (text == null || text.isEmpty) return [];
    try {
      final data = jsonDecode(text) as List;
      return data
          .whereType<Map>()
          .map((e) => ScoreInkMark.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> saveInk(List<ScoreInkMark> marks) async {
    final encoded = marks.map((e) => e.toJson()).toList();
    final json = jsonEncode(encoded);
    try {
      await _prefs.setString('$prefix.ink.v2', json);
    } catch (_) {
      // A very large legacy annotation set can exceed a platform preference
      // transaction. Never allow an autosave failure to terminate ScoreFlow.
    }
    try {
      await cloud?.set({
        'ownerUserId': owner,
        'documentId': '$songId',
        'marks': encoded,
        'lastEditedBy': FirebaseAuth.instance.currentUser?.uid,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    } catch (_) {}
  }

  Future<List<ScoreAnnotationLayerDefinition>> loadLayers() async {
    var text = await _prefs.getString('$prefix.annotationLayers.v1');
    if (text == null && ownerUserId == null)
      text = await _prefs.getString('practice.$songId.annotationLayers.v1');
    try {
      final remote = (await cloud?.get())?.data()?['layers'] as List?;
      if (remote != null) text = jsonEncode(remote);
    } catch (_) {}
    final custom = <ScoreAnnotationLayerDefinition>[];
    if (text != null && text.isNotEmpty) {
      try {
        final data = jsonDecode(text) as List;
        for (final item in data.whereType<Map>()) {
          final layer = ScoreAnnotationLayerDefinition.fromJson(
            Map<String, dynamic>.from(item),
          );
          if (layer.id.isEmpty ||
              defaultScoreAnnotationLayers.any((entry) => entry.id == layer.id))
            continue;
          custom.add(layer);
        }
      } catch (_) {}
    }
    return [...defaultScoreAnnotationLayers, ...custom];
  }

  Future<void> saveLayers(List<ScoreAnnotationLayerDefinition> layers) async {
    final encoded = layers
        .where((layer) => !layer.builtIn)
        .map((layer) => layer.toJson())
        .toList();
    try {
      await _prefs.setString(
        '$prefix.annotationLayers.v1',
        jsonEncode(encoded),
      );
    } catch (_) {
      // Keep the reader alive if a device storage write is temporarily unavailable.
    }
    try {
      await cloud?.set({
        'ownerUserId': owner,
        'documentId': '$songId',
        'layers': encoded,
        'lastEditedBy': FirebaseAuth.instance.currentUser?.uid,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));
    } catch (_) {}
  }

  Future<List<PracticeBookmark>> loadBookmarks() async {
    final text = await _prefs.getString('practice.$songId.bookmarks.v1');
    if (text == null || text.isEmpty) return [];
    try {
      final data = jsonDecode(text) as List;
      return data
          .whereType<Map>()
          .map((e) => PracticeBookmark.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> saveBookmarks(List<PracticeBookmark> bookmarks) =>
      _prefs.setString(
        'practice.$songId.bookmarks.v1',
        jsonEncode(bookmarks.map((e) => e.toJson()).toList()),
      );
}
