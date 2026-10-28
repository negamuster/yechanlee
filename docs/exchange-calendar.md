# Reviewed US equity sessions

Goal: show the scheduled NYSE regular session and next open on the desktop/mobile home page, show weekday holidays and early closes in the existing month/week calendar, and avoid querying known closures for Market Movers. This is a planned cash-equity timetable, not a real-time exchange status/halts feed. NYSE is the explicit reference; bonds, options, futures, crypto and extended-hours schedules are outside scope.

Use pinned `exchange_calendars` 4.13.2 in an offline Python generator. Commit a small JSON schedule for 2025-12-01 through 2028-12-31, checked against the full holiday/early-close lists within that range from the NYSE/ICE announcements recorded in `config/us-equity-calendar-review.json`. Jan 1 2028 is Saturday and Dec 31 2027 remains a trading session. Do not infer equity closures from Fed or federal holidays.

The review timestamp is a human official-source check. Generation time only records when the package output was built. Regeneration must not renew the official review timestamp. A disagreement with the reviewed holiday or early-close sets fails before atomic replacement. Updating the package or adding years requires reviewing the official lists first; there is no new scheduled collection/deployment job. Ad hoc changes after review require another review and deployment.

Node and the browser share the committed schedule and validation/helpers. Unknown/out-of-range/invalid schedules remain explicitly unknown. Known regular open is inclusive, close exclusive; UTC instants come from the package and display through IANA New York/KST rules. Holiday events remain US-date all-day events in ICS; early closes retain exact instants. UI refresh only reloads existing provider feeds and does not regenerate this timetable.

Market Movers uses scheduled sessions only, while retaining its conservative 21:00 ET provider-availability gate, coverage checks, original collection dates, backoff and stale retention. A provider's missing historical scheduled session is a failure, not another holiday to skip. An unpublished newest eligible session may retain the preceding consecutive verified sessions with the existing notice. Scheduled regular close does not prove that a daily aggregate, including extended-hours trades, is complete.

Validation must cover official holidays/early closes, DST and year boundaries, inclusive open/exclusive close, weekends, out-of-range, malformed/truncated schedule rejection, no provider request on known holidays, provider failure/empty historical sessions without fabricated returns, calendar category/filter/ICS behavior, API failure with independently available timetable, and desktop/mobile Chromium home/calendar flows. Keep existing lint/full Node/build and separate Python generation checks. Independent review is required by AGENTS.md. Main merge/production deployment are separate user requests.

Reproduce without API keys:

```sh
python -m venv .venv-calendar
.venv-calendar/bin/pip install -r requirements-calendar.txt
.venv-calendar/bin/python scripts/build-exchange-calendar.py --check
# After official review changes, regenerate explicitly:
.venv-calendar/bin/python scripts/build-exchange-calendar.py
```
