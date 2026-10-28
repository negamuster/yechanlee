"""Generate a reviewed NYSE cash-equity schedule, atomically and without live APIs."""
import argparse
import json
import os
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import exchange_calendars as xcals

ROOT = Path(__file__).resolve().parents[1]
VERSION = "4.13.2"


def build_schedule(review, generated_at=None):
    if xcals.__version__ != VERSION:
        raise ValueError("Install the pinned requirements-calendar.txt before generating")
    if review["calendar"] != "XNYS":
        raise ValueError("Only the reviewed NYSE cash-equity calendar is supported")
    start, end = date.fromisoformat(review["from"]), date.fromisoformat(review["to"])
    holidays, early = set(review["holidays"]), set(review["earlyCloses"])
    if start > end or len(holidays) != len(review["holidays"]) or len(early) != len(review["earlyCloses"]):
        raise ValueError("Invalid reviewed range or duplicate dates")
    calendar = xcals.get_calendar("XNYS", start=start.isoformat(), end=end.isoformat())
    sessions = []
    actual_holidays, actual_early = set(), set()
    ny = ZoneInfo("America/New_York")
    by_date = {index.date(): row for index, row in calendar.schedule.iterrows()}
    day = start
    while day <= end:
        key = day.isoformat()
        row = by_date.get(day)
        if row is None:
            if day.weekday() < 5:
                actual_holidays.add(key)
        else:
            opening, closing = row["open"].to_pydatetime(), row["close"].to_pydatetime()
            local_open, local_close = opening.astimezone(ny), closing.astimezone(ny)
            is_early = local_close.hour == 13
            if (day.weekday() >= 5 or local_open.date() != day or local_close.date() != day
                    or (local_open.hour, local_open.minute) != (9, 30)
                    or (local_close.hour, local_close.minute) != (13 if is_early else 16, 0)
                    or row["break_start"] is not None and not str(row["break_start"]) == "NaT"):
                raise ValueError(f"Unexpected NYSE session: {key}")
            if is_early:
                actual_early.add(key)
            sessions.append({"date": key, "open": opening.isoformat().replace("+00:00", "Z"),
                             "close": closing.isoformat().replace("+00:00", "Z"), "earlyClose": is_early})
        day += timedelta(days=1)
    if actual_holidays != holidays or actual_early != early:
        raise ValueError("Package schedule differs from reviewed official holidays/early closes; review before replacing")
    return {"version": 1, "calendar": "XNYS", "timezone": "America/New_York",
            "from": start.isoformat(), "to": end.isoformat(),
            "generatedAt": generated_at or datetime.now(timezone.utc).isoformat(),
            "reviewedAt": review["reviewedAt"], "officialSources": review["sources"],
            "package": {"name": "exchange_calendars", "version": VERSION,
                        "url": "https://github.com/gerrymanoim/exchange_calendars"},
            "holidays": sorted(actual_holidays), "sessions": sessions}


def write_schedule(target, payload):
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(target.suffix + ".tmp")
    try:
        temporary.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Compare committed schedule; do not renew timestamps")
    args = parser.parse_args()
    review = json.loads((ROOT / "config/us-equity-calendar-review.json").read_text())
    target = ROOT / "data/us-equity-sessions.json"
    previous = json.loads(target.read_text()) if args.check else None
    result = build_schedule(review, previous["generatedAt"] if previous else None)
    if args.check:
        if result != previous:
            raise SystemExit("Committed schedule differs from pinned package / official review")
        print(f"Verified {len(result['sessions'])} NYSE sessions against exchange_calendars {VERSION}")
    else:
        write_schedule(target, result)
        print(f"Generated {len(result['sessions'])} reviewed NYSE sessions")
