import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/intl.dart';
import 'package:musical/portal_models.dart';
import 'package:musical/production_time.dart';

class _EventReference implements DocumentReference<Map<String, dynamic>> {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  test(
    'live rehearsal stays at 3:30 pm rather than displaying UTC 9:30 pm',
    () {
      final event = PortalEvent(_EventReference(), {
        'startAt': '2026-09-22T15:30:00-06:00',
        'endAt': '2026-09-22T17:30:00-06:00',
        'callTime': '2026-09-22T15:15:00-06:00',
      });
      final start = event.start!, end = event.end!;
      expect(DateFormat('HH:mm').format(start), '15:30');
      expect(DateFormat('HH:mm').format(end), '17:30');
      expect(DateFormat('HH:mm').format(event.call!), '15:15');
      expect(start.toUtc(), DateTime.utc(2026, 9, 22, 21, 30));
      expect(end.difference(start), const Duration(hours: 2));
    },
  );

  test(
    'UTC strings, Firestore timestamps and epoch values display identically',
    () {
      final instant = DateTime.utc(2026, 9, 22, 21, 30);
      for (final value in [
        instant.toIso8601String(),
        instant,
        Timestamp.fromDate(instant),
        instant.millisecondsSinceEpoch,
      ]) {
        final date = productionDateField(
          {'StartAt': value},
          ['startAt', 'StartAt'],
        )!;
        expect(date.hour, 15);
        expect(date.minute, 30);
        expect(date.isAtSameMomentAs(instant), isTrue);
      }
    },
  );

  test('evening events and calls stay on the previous Saskatchewan date', () {
    final date = parseProductionTime('2026-12-04T01:00:00Z')!;
    final call = productionDateField(
      {'CallTime': '2026-12-04T00:30:00Z'},
      ['callTime', 'CallTime'],
    )!;
    expect(DateFormat('yyyy-MM-dd HH:mm').format(date), '2026-12-03 19:00');
    expect(DateFormat('yyyy-MM-dd HH:mm').format(call), '2026-12-03 18:30');
    expect(productionCalendarDate(date), DateTime.utc(2026, 12, 3));
  });

  test(
    'Regina time is consistent in summer, winter and across DST elsewhere',
    () {
      for (final iso in [
        '2026-01-15T21:30:00Z',
        '2026-07-15T21:30:00Z',
        '2026-03-08T21:30:00Z',
        '2026-11-01T21:30:00Z',
      ]) {
        final date = parseProductionTime(iso)!;
        expect(DateFormat('HH:mm').format(date), '15:30');
        expect(date.timeZoneOffset, const Duration(hours: -6));
      }
      final before = parseProductionTime('2026-03-07T12:00:00-06:00')!;
      final after = parseProductionTime('2026-03-09T12:00:00-06:00')!;
      expect(
        productionCalendarDate(after)
            .difference(productionCalendarDate(before))
            .inDays,
        2,
      );
    },
  );

  test('legacy dates and unzoned times retain their school wall time', () {
    expect(parseProductionTime('2026-09-22T15:30:00')!.hour, 15);
    expect(parseProductionTime('2026-09-22')!.day, 22);
    expect(parseProductionTime('2026-09-22')!.hour, 0);
    expect(parseProductionTime('invalid'), isNull);
    expect(productionDateField({}, ['startAt']), isNull);
  });
}
