import 'dart:math' as math;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import 'music_notation_symbols.dart';
import 'practice_notes_store.dart';

class ScoreAnnotationLayer extends StatefulWidget {
  const ScoreAnnotationLayer({
    super.key,
    required this.enabled,
    required this.page,
    required this.marks,
    required this.tool,
    required this.color,
    required this.stamp,
    required this.activeLayerId,
    required this.visibleLayers,
    required this.widthFactor,
    required this.opacity,
    required this.stylusOnly,
    required this.onMarksChanged,
    required this.onTextRequested,
    required this.onEditStart,
    required this.selectedMarkId,
    required this.selectedMarkIds,
    required this.onSelectionChanged,
    required this.onSelectionSetChanged,
    required this.onNavigateStart,
    required this.onNavigateUpdate,
    required this.onNavigateEnd,
    required this.onSelectedTransformStart,
    required this.onSelectedTransformUpdate,
    required this.onSelectedTransformEnd,
  });

  final bool enabled;
  final int page;
  final List<ScoreInkMark> marks;
  final ScoreInkTool tool;
  final Color color;
  final String stamp;
  final String activeLayerId;
  final Set<String> visibleLayers;
  final double widthFactor;
  final double opacity;
  final bool stylusOnly;
  final ValueChanged<List<ScoreInkMark>> onMarksChanged;
  final Future<String?> Function(int page, Offset normalizedPoint)
  onTextRequested;
  final VoidCallback onEditStart;
  final String? selectedMarkId;
  final Set<String> selectedMarkIds;
  final ValueChanged<String?> onSelectionChanged;
  final ValueChanged<Set<String>> onSelectionSetChanged;
  final ValueChanged<Offset> onNavigateStart;
  final void Function(Offset globalFocalPoint, double relativeScale)
  onNavigateUpdate;
  final VoidCallback onNavigateEnd;
  final ValueChanged<String> onSelectedTransformStart;
  final void Function(String markId, double relativeScale, double rotationDelta)
  onSelectedTransformUpdate;
  final ValueChanged<String> onSelectedTransformEnd;

  @override
  State<ScoreAnnotationLayer> createState() => _ScoreAnnotationLayerState();
}

class _ScoreAnnotationLayerState extends State<ScoreAnnotationLayer> {
  static const int _maximumStrokePoints = 1600;
  static const int _maximumLassoPoints = 600;
  static const double _minimumPointDistance = .00065;
  List<Offset> _draft = const [];
  String? _movingId;
  Set<String> _movingIds = <String>{};
  Offset? _lastMovePoint;
  final Map<int, PointerDeviceKind> _pointerKinds = <int, PointerDeviceKind>{};
  bool _navigating = false;
  double _navigationGestureScaleBase = 1;
  bool _transformingSelected = false;
  String? _transformingSelectedId;
  double _selectedTransformScaleBase = 1;
  double _selectedTransformRotationBase = 0;
  bool _inkGestureEditStarted = false;

  bool _isStylus(PointerDeviceKind kind) =>
      kind == PointerDeviceKind.stylus ||
      kind == PointerDeviceKind.invertedStylus;

  bool get _hasStylusPointer => _pointerKinds.values.any(_isStylus);

  bool _singlePointerShouldNavigate() =>
      widget.tool == ScoreInkTool.navigate ||
      (widget.stylusOnly && !_hasStylusPointer);

  bool _singlePointerCanInk() => !widget.stylusOnly || _hasStylusPointer;

  void _appendDraftPoint(Offset point, {required bool lasso}) {
    final limit = lasso ? _maximumLassoPoints : _maximumStrokePoints;
    if (_draft.isNotEmpty &&
        (_draft.last - point).distance < _minimumPointDistance) {
      return;
    }
    setState(() {
      if (_draft.length >= limit) {
        // Preserve the shape of exceptionally long gestures without allowing
        // an unbounded point list to exhaust memory on older phones/tablets.
        _draft = [for (var i = 0; i < _draft.length; i += 2) _draft[i]];
      }
      _draft.add(point);
    });
  }

  Offset _normalized(Offset point, Size size) => Offset(
    (point.dx / math.max(1, size.width)).clamp(0.0, 1.0).toDouble(),
    (point.dy / math.max(1, size.height)).clamp(0.0, 1.0).toDouble(),
  );

  ScoreInkMark? _nearestEditableMark(Offset normalized) {
    ScoreInkMark? best;
    var bestDistance = .055;
    for (final mark in widget.marks.reversed) {
      if (mark.page != widget.page || mark.layerId != widget.activeLayerId)
        continue;
      if (mark.points.isEmpty) continue;
      final distance = _distanceToMark(mark, normalized);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = mark;
      }
    }
    return best;
  }

  double _distanceToMark(ScoreInkMark mark, Offset point) {
    if (mark.points.length == 1) return (mark.points.first - point).distance;
    var distance = double.infinity;
    for (final p in mark.points) {
      distance = math.min(distance, (p - point).distance);
    }
    if (mark.kind == ScoreMarkKind.rectangle ||
        mark.kind == ScoreMarkKind.ellipse) {
      final a = mark.points.first;
      final b = mark.points.last;
      final center = Offset((a.dx + b.dx) / 2, (a.dy + b.dy) / 2);
      distance = math.min(distance, (center - point).distance);
    }
    return distance;
  }

  void _eraseNear(Offset normalized) {
    final target = _nearestEditableMark(normalized);
    if (target == null) return;
    final next = List<ScoreInkMark>.from(widget.marks)
      ..removeWhere((m) => m.id == target.id);
    widget.onMarksChanged(next);
  }

  ScoreMarkKind _kindForTool() {
    switch (widget.tool) {
      case ScoreInkTool.highlighter:
        return ScoreMarkKind.highlighter;
      case ScoreInkTool.line:
        return ScoreMarkKind.line;
      case ScoreInkTool.arrow:
        return ScoreMarkKind.arrow;
      case ScoreInkTool.rectangle:
        return ScoreMarkKind.rectangle;
      case ScoreInkTool.ellipse:
        return ScoreMarkKind.ellipse;
      default:
        return ScoreMarkKind.stroke;
    }
  }

  void _commitDraft() {
    if (_draft.isEmpty) return;
    final kind = _kindForTool();
    final needsTwoPoints =
        kind != ScoreMarkKind.stroke && kind != ScoreMarkKind.highlighter;
    if ((needsTwoPoints && _draft.length < 2) ||
        (!needsTwoPoints && _draft.length < 2)) {
      setState(() => _draft = const []);
      return;
    }
    final points = needsTwoPoints
        ? [_draft.first, _draft.last]
        : List<Offset>.from(_draft);
    final highlighter = kind == ScoreMarkKind.highlighter;
    final next = List<ScoreInkMark>.from(widget.marks)
      ..add(
        ScoreInkMark(
          id: DateTime.now().microsecondsSinceEpoch.toString(),
          page: widget.page,
          points: points,
          colorValue: widget.color.toARGB32(),
          widthFactor: highlighter
              ? widget.widthFactor * 4.6
              : widget.widthFactor,
          opacity: highlighter ? math.min(widget.opacity, .35) : widget.opacity,
          kind: kind,
          layerId: widget.activeLayerId,
        ),
      );
    setState(() => _draft = const []);
    widget.onMarksChanged(next);
  }

  Future<void> _handleTap(TapUpDetails details, Size size) async {
    if (widget.stylusOnly && !_isStylus(details.kind)) return;
    final point = _normalized(details.localPosition, size);
    if (widget.tool == ScoreInkTool.move) {
      final target = _nearestEditableMark(point);
      final ids = target == null ? <String>{} : <String>{target.id};
      widget.onSelectionSetChanged(ids);
      widget.onSelectionChanged(target?.id);
      return;
    }
    if (widget.tool == ScoreInkTool.stamp) {
      widget.onEditStart();
      final id = DateTime.now().microsecondsSinceEpoch.toString();
      final next = List<ScoreInkMark>.from(widget.marks)
        ..add(
          ScoreInkMark(
            id: id,
            page: widget.page,
            points: [point],
            colorValue: widget.color.toARGB32(),
            widthFactor: widget.widthFactor,
            opacity: widget.opacity,
            kind: ScoreMarkKind.stamp,
            stamp: widget.stamp,
            layerId: widget.activeLayerId,
          ),
        );
      widget.onMarksChanged(next);
      // Keep the symbol tool active for rapid repeated placement, but select
      // the newest symbol so its resize/rotate quick bar appears immediately.
      widget.onSelectionSetChanged(<String>{id});
      widget.onSelectionChanged(id);
      return;
    }
    if (widget.tool == ScoreInkTool.text) {
      final text = await widget.onTextRequested(widget.page, point);
      if (!mounted || text == null || text.trim().isEmpty) return;
      widget.onEditStart();
      final id = DateTime.now().microsecondsSinceEpoch.toString();
      final next = List<ScoreInkMark>.from(widget.marks)
        ..add(
          ScoreInkMark(
            id: id,
            page: widget.page,
            points: [point],
            colorValue: widget.color.toARGB32(),
            widthFactor: widget.widthFactor,
            opacity: widget.opacity,
            kind: ScoreMarkKind.text,
            text: text.trim(),
            layerId: widget.activeLayerId,
          ),
        );
      widget.onMarksChanged(next);
      widget.onSelectionSetChanged(<String>{id});
      widget.onSelectionChanged(id);
    }
  }

  void _cancelDraftForNavigation() {
    _inkGestureEditStarted = false;
    if (_draft.isEmpty && _movingId == null && _lastMovePoint == null) return;
    setState(() {
      _draft = const [];
      _movingId = null;
      _movingIds = <String>{};
      _lastMovePoint = null;
    });
  }

  void _startNavigation(Offset globalFocalPoint, double gestureScale) {
    _cancelDraftForNavigation();
    _navigating = true;
    _navigationGestureScaleBase = gestureScale.abs() < .0001 ? 1 : gestureScale;
    widget.onNavigateStart(globalFocalPoint);
  }

  ScoreInkMark? _selectedTransformMarkAt(Offset localFocalPoint, Size size) {
    final selectedId = widget.selectedMarkId;
    if (selectedId == null) return null;
    ScoreInkMark? mark;
    for (final candidate in widget.marks.reversed) {
      if (candidate.id == selectedId) {
        mark = candidate;
        break;
      }
    }
    if (mark == null || mark.page != widget.page || mark.points.isEmpty)
      return null;
    if (mark.kind != ScoreMarkKind.stamp && mark.kind != ScoreMarkKind.text)
      return null;

    final anchor = Offset(
      mark.points.first.dx * size.width,
      mark.points.first.dy * size.height,
    );
    final scale = mark.scale.clamp(.35, 4.0).toDouble();
    final content = mark.kind == ScoreMarkKind.stamp ? mark.stamp : mark.text;
    final isMusicSymbol =
        mark.kind == ScoreMarkKind.stamp &&
        content != null &&
        (musicNotationSymbolForStamp(content) != null ||
            content == ',' ||
            content == 'BREATH');

    // The gesture target is intentionally more generous than the painted
    // glyph. Two fingertips obscure the symbol, so singers should not need
    // pixel-perfect placement before pinching or twisting it.
    final targetWidth = isMusicSymbol
        ? math.max(92.0, size.width * .12 * scale)
        : math.max(126.0, size.width * .24 * scale);
    final targetHeight = math.max(92.0, size.width * .10 * scale);
    return Rect.fromCenter(
          center: anchor,
          width: targetWidth,
          height: targetHeight,
        ).contains(localFocalPoint)
        ? mark
        : null;
  }

  bool _tryStartSelectedTransform(ScaleUpdateDetails details, Size size) {
    if (details.pointerCount < 2) return false;
    final mark = _selectedTransformMarkAt(details.localFocalPoint, size);
    if (mark == null) return false;

    if (_navigating) {
      _navigating = false;
      _navigationGestureScaleBase = 1;
      widget.onNavigateEnd();
    }
    _cancelDraftForNavigation();
    _transformingSelected = true;
    _transformingSelectedId = mark.id;
    _selectedTransformScaleBase = details.scale.abs() < .0001
        ? 1
        : details.scale;
    _selectedTransformRotationBase = details.rotation;
    widget.onSelectedTransformStart(mark.id);
    return true;
  }

  bool _pointInsidePolygon(Offset point, List<Offset> polygon) {
    if (polygon.length < 3) return false;
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      final a = polygon[i];
      final b = polygon[j];
      final intersects =
          ((a.dy > point.dy) != (b.dy > point.dy)) &&
          (point.dx <
              (b.dx - a.dx) *
                      (point.dy - a.dy) /
                      ((b.dy - a.dy).abs() < .000001
                          ? .000001
                          : (b.dy - a.dy)) +
                  a.dx);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  bool _markInsideLasso(ScoreInkMark mark, List<Offset> polygon) {
    if (mark.points.isEmpty) return false;
    if (mark.points.any((point) => _pointInsidePolygon(point, polygon)))
      return true;
    final dx =
        mark.points.map((p) => p.dx).reduce((a, b) => a + b) /
        mark.points.length;
    final dy =
        mark.points.map((p) => p.dy).reduce((a, b) => a + b) /
        mark.points.length;
    return _pointInsidePolygon(Offset(dx, dy), polygon);
  }

  void _finishLasso() {
    final polygon = List<Offset>.from(_draft);
    setState(() => _draft = const []);
    if (polygon.length < 3) {
      widget.onSelectionSetChanged(<String>{});
      widget.onSelectionChanged(null);
      return;
    }
    final ids = widget.marks
        .where(
          (mark) =>
              mark.page == widget.page &&
              mark.layerId == widget.activeLayerId &&
              widget.visibleLayers.contains(mark.layerId) &&
              _markInsideLasso(mark, polygon),
        )
        .map((mark) => mark.id)
        .toSet();
    widget.onSelectionSetChanged(ids);
    widget.onSelectionChanged(ids.length == 1 ? ids.first : null);
  }

  void _startInkGesture(ScaleStartDetails details, Size size) {
    if (!_singlePointerCanInk()) return;
    if (widget.tool == ScoreInkTool.stamp || widget.tool == ScoreInkTool.text)
      return;
    _inkGestureEditStarted = false;
    final point = _normalized(details.localFocalPoint, size);
    if (widget.tool == ScoreInkTool.eraser) {
      return;
    } else if (widget.tool == ScoreInkTool.lasso) {
      setState(() => _draft = [point]);
    } else if (widget.tool == ScoreInkTool.move) {
      final target = _nearestEditableMark(point);
      final currentSelection = widget.selectedMarkIds;
      final movingIds = target == null
          ? <String>{}
          : (currentSelection.length > 1 && currentSelection.contains(target.id)
                ? Set<String>.from(currentSelection)
                : <String>{target.id});
      widget.onSelectionSetChanged(movingIds);
      widget.onSelectionChanged(movingIds.length == 1 ? movingIds.first : null);
      setState(() {
        _movingId = target?.id;
        _movingIds = movingIds;
        _lastMovePoint = point;
      });
    } else {
      setState(() => _draft = [point]);
    }
  }

  void _updateInkGesture(ScaleUpdateDetails details, Size size) {
    final point = _normalized(details.localFocalPoint, size);
    if (widget.tool == ScoreInkTool.lasso) {
      _appendDraftPoint(point, lasso: true);
      return;
    }
    if (!_inkGestureEditStarted) {
      widget.onEditStart();
      _inkGestureEditStarted = true;
    }
    if (widget.tool == ScoreInkTool.eraser) {
      _eraseNear(point);
    } else if (widget.tool == ScoreInkTool.move) {
      final previous = _lastMovePoint;
      if (_movingIds.isEmpty || previous == null) return;
      final delta = point - previous;
      final next = widget.marks
          .map(
            (mark) => _movingIds.contains(mark.id)
                ? mark.copyWith(
                    points: mark.points
                        .map(
                          (p) => Offset(
                            (p.dx + delta.dx).clamp(0.0, 1.0).toDouble(),
                            (p.dy + delta.dy).clamp(0.0, 1.0).toDouble(),
                          ),
                        )
                        .toList(),
                  )
                : mark,
          )
          .toList();
      _lastMovePoint = point;
      widget.onMarksChanged(next);
    } else if (widget.tool != ScoreInkTool.stamp &&
        widget.tool != ScoreInkTool.text) {
      _appendDraftPoint(point, lasso: false);
    }
  }

  void _finishInkGesture() {
    final edited = _inkGestureEditStarted;
    _inkGestureEditStarted = false;
    if (widget.tool == ScoreInkTool.stamp ||
        widget.tool == ScoreInkTool.text ||
        widget.tool == ScoreInkTool.eraser) {
      return;
    }
    if (widget.tool == ScoreInkTool.lasso) {
      _finishLasso();
    } else if (widget.tool == ScoreInkTool.move) {
      setState(() {
        _movingId = null;
        _movingIds = <String>{};
        _lastMovePoint = null;
      });
    } else if (edited) {
      _commitDraft();
    } else if (_draft.isNotEmpty) {
      setState(() => _draft = const []);
    }
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final size = Size(constraints.maxWidth, constraints.maxHeight);
      return IgnorePointer(
        ignoring: !widget.enabled,
        child: Listener(
          behavior: HitTestBehavior.translucent,
          onPointerDown: (event) => _pointerKinds[event.pointer] = event.kind,
          onPointerUp: (event) => _pointerKinds.remove(event.pointer),
          onPointerCancel: (event) => _pointerKinds.remove(event.pointer),
          child: GestureDetector(
            dragStartBehavior: DragStartBehavior.down,
            behavior: HitTestBehavior.translucent,
            onTapUp:
                widget.tool == ScoreInkTool.stamp ||
                    widget.tool == ScoreInkTool.text ||
                    widget.tool == ScoreInkTool.move
                ? (details) => _handleTap(details, size)
                : null,
            onScaleStart: (details) {
              if (_singlePointerShouldNavigate()) {
                _startNavigation(details.focalPoint, 1);
                return;
              }
              _startInkGesture(details, size);
            },
            onScaleUpdate: (details) {
              // A two-finger gesture that begins over the selected symbol
              // belongs to that symbol: pinch resizes and twist rotates.
              // The same two-finger gesture anywhere else still navigates
              // the PDF, so annotation mode never needs to be exited.
              if (!_transformingSelected && details.pointerCount >= 2) {
                _tryStartSelectedTransform(details, size);
              }
              if (_transformingSelected) {
                final id = _transformingSelectedId;
                if (id != null) {
                  final relativeScale =
                      details.scale / _selectedTransformScaleBase;
                  final rotationDelta =
                      details.rotation - _selectedTransformRotationBase;
                  widget.onSelectedTransformUpdate(
                    id,
                    relativeScale,
                    rotationDelta,
                  );
                }
                return;
              }

              final wantsNavigation =
                  _navigating ||
                  details.pointerCount >= 2 ||
                  widget.tool == ScoreInkTool.navigate ||
                  (widget.stylusOnly && !_hasStylusPointer);
              if (wantsNavigation) {
                if (!_navigating) {
                  _startNavigation(details.focalPoint, details.scale);
                }
                final relativeScale =
                    details.scale / _navigationGestureScaleBase;
                widget.onNavigateUpdate(details.focalPoint, relativeScale);
                return;
              }
              _updateInkGesture(details, size);
            },
            onScaleEnd: (_) {
              if (_transformingSelected) {
                final id = _transformingSelectedId;
                _transformingSelected = false;
                _transformingSelectedId = null;
                _selectedTransformScaleBase = 1;
                _selectedTransformRotationBase = 0;
                if (id != null) widget.onSelectedTransformEnd(id);
                return;
              }
              if (_navigating) {
                _navigating = false;
                _navigationGestureScaleBase = 1;
                widget.onNavigateEnd();
                return;
              }
              _finishInkGesture();
            },
            child: CustomPaint(
              painter: ScoreInkPainter(
                marks: widget.marks
                    .where(
                      (m) =>
                          m.page == widget.page &&
                          widget.visibleLayers.contains(m.layerId),
                    )
                    .toList(),
                draft: _draft,
                draftColor: widget.color,
                draftKind: _kindForTool(),
                draftWidthFactor: widget.widthFactor,
                draftOpacity: widget.opacity,
                selectedId: _movingId ?? widget.selectedMarkId,
                selectedIds: widget.selectedMarkIds,
                lasso: widget.tool == ScoreInkTool.lasso ? _draft : const [],
              ),
              size: Size.infinite,
            ),
          ),
        ),
      );
    },
  );
}

class ScoreInkPainter extends CustomPainter {
  ScoreInkPainter({
    required this.marks,
    required this.draft,
    required this.draftColor,
    required this.draftKind,
    required this.draftWidthFactor,
    required this.draftOpacity,
    this.selectedId,
    this.selectedIds = const <String>{},
    this.lasso = const <Offset>[],
  });

  final List<ScoreInkMark> marks;
  final List<Offset> draft;
  final Color draftColor;
  final ScoreMarkKind draftKind;
  final double draftWidthFactor;
  final double draftOpacity;
  final String? selectedId;
  final Set<String> selectedIds;
  final List<Offset> lasso;

  @override
  void paint(Canvas canvas, Size size) {
    for (final mark in marks) {
      paintScoreMark(
        canvas,
        size,
        mark,
        selected: mark.id == selectedId || selectedIds.contains(mark.id),
      );
    }
    if (lasso.length >= 2) {
      final path = Path()
        ..moveTo(lasso.first.dx * size.width, lasso.first.dy * size.height);
      for (final point in lasso.skip(1)) {
        path.lineTo(point.dx * size.width, point.dy * size.height);
      }
      if (lasso.length >= 3) path.close();
      canvas.drawPath(
        path,
        Paint()
          ..color = const Color(0xFF28D7FF).withValues(alpha: .92)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeCap = StrokeCap.round,
      );
    }
    if (draft.length >= 2 && lasso.isEmpty) {
      final preview = ScoreInkMark(
        id: 'draft',
        page: 0,
        points:
            draftKind == ScoreMarkKind.stroke ||
                draftKind == ScoreMarkKind.highlighter
            ? draft
            : [draft.first, draft.last],
        colorValue: draftColor.toARGB32(),
        widthFactor: draftKind == ScoreMarkKind.highlighter
            ? draftWidthFactor * 4.6
            : draftWidthFactor,
        opacity: draftKind == ScoreMarkKind.highlighter
            ? math.min(draftOpacity, .35)
            : draftOpacity,
        kind: draftKind,
      );
      paintScoreMark(canvas, size, preview);
    }
  }

  @override
  bool shouldRepaint(covariant ScoreInkPainter oldDelegate) =>
      oldDelegate.marks != marks ||
      oldDelegate.draft != draft ||
      oldDelegate.draftColor != draftColor ||
      oldDelegate.draftKind != draftKind ||
      oldDelegate.draftWidthFactor != draftWidthFactor ||
      oldDelegate.draftOpacity != draftOpacity ||
      oldDelegate.selectedId != selectedId ||
      oldDelegate.selectedIds != selectedIds ||
      oldDelegate.lasso != lasso;
}

void paintScoreMark(
  Canvas canvas,
  Size size,
  ScoreInkMark mark, {
  bool selected = false,
}) {
  if (mark.points.isEmpty) return;
  final color = Color(mark.colorValue)
      .withValues(alpha: mark.opacity.clamp(0.0, 1.0));
  final strokeWidth = math.max(1.0, mark.widthFactor * size.width);
  final points = mark.points
      .map((p) => Offset(p.dx * size.width, p.dy * size.height))
      .toList();
  final paint = Paint()
    ..color = color
    ..strokeWidth = strokeWidth
    ..style = PaintingStyle.stroke
    ..strokeCap = StrokeCap.round
    ..strokeJoin = StrokeJoin.round;

  switch (mark.kind) {
    case ScoreMarkKind.stamp:
    case ScoreMarkKind.text:
      final content = mark.kind == ScoreMarkKind.stamp ? mark.stamp : mark.text;
      if (content == null || content.isEmpty) return;
      final legacyBreath =
          mark.kind == ScoreMarkKind.stamp &&
          (content == ',' || content == 'BREATH');
      final symbol = musicNotationSymbolForStamp(content);
      final isMusicSymbol = symbol != null || legacyBreath;
      final displayContent = legacyBreath
          ? String.fromCharCode(0xE4CE)
          : (symbol?.glyph ?? content);
      final symbolScale = symbol?.scale ?? (legacyBreath ? 1.2 : 1.0);
      final fontSize = math.max(
        10.0,
        size.width *
            (isMusicSymbol
                ? .038 * symbolScale
                : (mark.kind == ScoreMarkKind.stamp ? .021 : .019)) *
            mark.scale.clamp(.35, 4.0),
      );
      final painter = TextPainter(
        text: TextSpan(
          text: displayContent,
          style: TextStyle(
            color: Color(mark.colorValue)
                .withValues(alpha: mark.opacity.clamp(0.0, 1.0)),
            fontFamily: isMusicSymbol ? 'Bravura' : null,
            fontWeight: isMusicSymbol
                ? FontWeight.normal
                : (mark.kind == ScoreMarkKind.stamp
                      ? FontWeight.w900
                      : FontWeight.w700),
            fontSize: fontSize,
            backgroundColor: isMusicSymbol
                ? null
                : Colors.white.withValues(alpha: .78),
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout(maxWidth: size.width * .55);

      // A placed annotation point represents the user's intended anchor.
      // Text notes / choral labels intentionally begin at that point, but
      // SMuFL glyphs should sit ON the tap rather than treating the tap as
      // the glyph's top-left corner. Bravura's font box otherwise makes the
      // visible symbol appear noticeably below and to the right of the tap.
      final anchor = points.first;
      final localPaintOffset = isMusicSymbol
          ? Offset(-painter.width / 2, -painter.height / 2)
          : Offset.zero;

      // Text / stamp transforms are stored independently from their anchor, so
      // resizing and rotating never changes the point the singer placed on the
      // score. This also keeps screen rendering and PDF export identical.
      canvas.save();
      canvas.translate(anchor.dx, anchor.dy);
      canvas.rotate(mark.rotation);
      painter.paint(canvas, localPaintOffset);
      if (selected) {
        canvas.drawRect(
          Rect.fromLTWH(
            localPaintOffset.dx,
            localPaintOffset.dy,
            painter.width,
            painter.height,
          ).inflate(6),
          Paint()
            ..color = Colors.lightBlueAccent.withValues(alpha: .85)
            ..strokeWidth = 1.5
            ..style = PaintingStyle.stroke,
        );
      }
      canvas.restore();
      break;
    case ScoreMarkKind.line:
      if (points.length >= 2) canvas.drawLine(points.first, points.last, paint);
      break;
    case ScoreMarkKind.arrow:
      if (points.length >= 2)
        _drawArrow(canvas, points.first, points.last, paint);
      break;
    case ScoreMarkKind.rectangle:
      if (points.length >= 2)
        canvas.drawRect(Rect.fromPoints(points.first, points.last), paint);
      break;
    case ScoreMarkKind.ellipse:
      if (points.length >= 2)
        canvas.drawOval(Rect.fromPoints(points.first, points.last), paint);
      break;
    case ScoreMarkKind.stroke:
    case ScoreMarkKind.highlighter:
      _drawSmoothStroke(canvas, points, paint);
      break;
  }

  if (selected &&
      mark.kind != ScoreMarkKind.stamp &&
      mark.kind != ScoreMarkKind.text) {
    final bounds = _pointsBounds(points).inflate(8);
    canvas.drawRect(
      bounds,
      Paint()
        ..color = Colors.lightBlueAccent.withValues(alpha: .8)
        ..strokeWidth = 1.5
        ..style = PaintingStyle.stroke,
    );
  }
}

void _drawSmoothStroke(Canvas canvas, List<Offset> points, Paint paint) {
  if (points.length < 2) return;
  if (points.length == 2) {
    canvas.drawLine(points.first, points.last, paint);
    return;
  }
  final path = Path()..moveTo(points.first.dx, points.first.dy);
  for (var i = 1; i < points.length - 1; i++) {
    final current = points[i];
    final next = points[i + 1];
    final midpoint = Offset(
      (current.dx + next.dx) / 2,
      (current.dy + next.dy) / 2,
    );
    path.quadraticBezierTo(current.dx, current.dy, midpoint.dx, midpoint.dy);
  }
  path.lineTo(points.last.dx, points.last.dy);
  canvas.drawPath(path, paint);
}

void _drawArrow(Canvas canvas, Offset start, Offset end, Paint paint) {
  canvas.drawLine(start, end, paint);
  final angle = math.atan2(end.dy - start.dy, end.dx - start.dx);
  final head = math.max(8.0, paint.strokeWidth * 4.0);
  const spread = math.pi / 7;
  final p1 = Offset(
    end.dx - head * math.cos(angle - spread),
    end.dy - head * math.sin(angle - spread),
  );
  final p2 = Offset(
    end.dx - head * math.cos(angle + spread),
    end.dy - head * math.sin(angle + spread),
  );
  canvas.drawLine(end, p1, paint);
  canvas.drawLine(end, p2, paint);
}

Rect _pointsBounds(List<Offset> points) {
  if (points.isEmpty) return Rect.zero;
  var minX = points.first.dx;
  var maxX = points.first.dx;
  var minY = points.first.dy;
  var maxY = points.first.dy;
  for (final p in points.skip(1)) {
    minX = math.min(minX, p.dx);
    maxX = math.max(maxX, p.dx);
    minY = math.min(minY, p.dy);
    maxY = math.max(maxY, p.dy);
  }
  return Rect.fromLTRB(minX, minY, maxX, maxY);
}
