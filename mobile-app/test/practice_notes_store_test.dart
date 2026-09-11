import 'dart:ui';

import 'package:musical/annotation/practice_notes_store.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('annotation mark uses Firestore-safe top-level point data', () {
    const mark = ScoreInkMark(
      id: 'mark-1',
      page: 3,
      points: [Offset(.1, .2), Offset(.3, .4)],
      colorValue: 0xFF000000,
      widthFactor: .004,
      opacity: 1,
      kind: ScoreMarkKind.stroke,
    );

    final encoded = mark.toJson();
    expect(encoded['points'], [
      {'x': .1, 'y': .2},
      {'x': .3, 'y': .4},
    ]);
    expect(ScoreInkMark.fromJson(encoded).points, mark.points);
  });

  test('legacy coordinate pairs remain readable on device', () {
    final mark = ScoreInkMark.fromJson({
      'id': 'legacy',
      'page': 1,
      'points': [
        [.25, .5],
        [.75, 1.0],
      ],
    });

    expect(mark.points, const [Offset(.25, .5), Offset(.75, 1)]);
  });
}
