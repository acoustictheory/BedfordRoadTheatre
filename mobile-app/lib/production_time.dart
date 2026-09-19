import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

// Match the website's explicit production time zone, even while travelling.
final tz.Location productionTimeZone = (() {
  tz_data.initializeTimeZones();
  return tz.getLocation('America/Regina');
})();

DateTime productionTime(DateTime instant) =>
    tz.TZDateTime.from(instant, productionTimeZone);

DateTime productionNow() => tz.TZDateTime.now(productionTimeZone);

DateTime? parseProductionTime(String value) {
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return null;
  if (parsed.isUtc) return productionTime(parsed);
  // Older date-only or unzoned values represent school wall time, not the
  // phone's current zone. Do not reinterpret them as UTC instants.
  return tz.TZDateTime(
    productionTimeZone,
    parsed.year,
    parsed.month,
    parsed.day,
    parsed.hour,
    parsed.minute,
    parsed.second,
    parsed.millisecond,
    parsed.microsecond,
  );
}

// A calendar-day key, not an event instant. UTC keeps day differences stable
// even when the device's local zone has a daylight-saving transition.
DateTime productionCalendarDate(DateTime instant) {
  final local = productionTime(instant);
  return DateTime.utc(local.year, local.month, local.day);
}
