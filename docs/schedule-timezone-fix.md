# Schedule timezone repair — 2.16.3+63

The native Android and iOS schedule parsed offset-bearing timestamps using
`DateTime.tryParse`, then passed those UTC DateTime values straight to
`DateFormat`. The website explicitly formats event times in `America/Regina`.
This made native event times six hours late and could put evening events on
the following calendar day.

A read-only check of the live schedule reproduced the difference:

| Stored start | Correct Saskatchewan time | Previous native display |
| --- | --- | --- |
| `2026-09-22T15:30:00-06:00` | September 22, 3:30 p.m. | September 22, 9:30 p.m. |
| `2026-09-19T09:00:00-06:00` | September 19, 9:00 a.m. | September 19, 3:00 p.m. |

`production_time.dart` now converts event instants to the IANA
`America/Regina` zone. `PortalEvent` applies it to start, end, and call times,
which covers both the schedule and dashboard. Calendar grouping, month
selection and Today highlighting use Saskatchewan dates even when the device
is elsewhere. Unzoned legacy values retain their school wall time. The
existing timezone dependency is now declared directly; its version was not
upgraded.

No event records, stored times, or website schedule formatting were changed.
The app subtitle explicitly identifies Saskatchewan time.

The Flutter tests cover the live timestamp shape, UTC strings, Firestore
timestamps, epoch values, call times, midnight rollover, summer/winter dates,
day grouping across daylight-saving transitions elsewhere, and legacy values.

Release version: `2.16.3+63`. Both native platforms require installing a new
build. The iOS build uses `bedford-ios-testflight` on Codemagic; editing shared
source or publishing the website does not update an installed TestFlight app.
