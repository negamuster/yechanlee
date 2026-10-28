"""Bounded EdgarTools metadata collection. No filing bodies or personal watchlists."""
import argparse
import copy
import datetime as dt
import json
import os
from pathlib import Path
import re
import tempfile
import time

FORMS = ("10-K", "10-K/A", "10-Q", "10-Q/A", "8-K", "8-K/A", "20-F", "20-F/A", "40-F", "40-F/A", "6-K", "6-K/A")
ROOT = Path(__file__).resolve().parents[1]


def valid_date(value):
    return isinstance(value, str) and dt.date.fromisoformat(value).isoformat() == value


def normalize_rows(rows, cik, start, end, limit):
    result = {}
    for row in rows:
        form, accession = row.get("form"), row.get("accession_number")
        filed = str(row.get("filing_date"))
        if form not in FORMS or not re.fullmatch(r"\d{10}-\d{2}-\d{6}", accession or "") or not valid_date(filed):
            raise ValueError("Invalid filing metadata")
        if not start <= filed <= end:
            raise ValueError("Filing outside requested coverage")
        report = row.get("reportDate")
        report = str(report) if report else None
        if report is not None and (not valid_date(report) or report > filed):
            raise ValueError("Invalid report date")
        item = {"accession": accession, "form": form, "filed": filed, "reportDate": report,
                "url": f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession.replace('-', '')}/{accession}-index.html"}
        if accession in result and result[accession] != item:
            raise ValueError("Conflicting accession")
        result[accession] = item
    # Filing date is an SEC date, not a fabricated midnight receipt/acceptance time.
    return sorted(result.values(), key=lambda r: (r["filed"], r["accession"]), reverse=True)[:limit]


class CollectedFilings(list):
    def __init__(self, rows, coverage_from):
        super().__init__(rows)
        self.coverage_from = coverage_from


def collect_company(target, start, end, limit):
    from edgar import Company
    company = Company(int(target["cik"]))
    if int(company.cik) != int(target["cik"]):
        raise ValueError("Company identity mismatch")
    recent = company.get_filings(trigger_full_load=False)
    dates = recent.data.column("filing_date").to_pylist() if recent is not None else []
    if not dates:
        raise ValueError("No submission history to establish coverage")
    coverage_from = max(start, min(str(d) for d in dates))
    if coverage_from > start and getattr(company.data, "files", None) != []:
        raise ValueError("Recent submissions do not cover the requested window")
    # A new CIK with an explicitly empty SEC archive index has a shorter history.
    # Publish only that proven range; never imply predecessor filings are included.
    filings = company.get_filings(form=list(FORMS), filing_date=f"{start}:{end}", amendments=True, trigger_full_load=False)
    rows = [] if filings is None else filings.to_pandas().to_dict("records")
    return CollectedFilings(normalize_rows(rows, target["cik"], coverage_from, end, limit), coverage_from)


def refresh(config, previous, collector=collect_company, now=None):
    clock = (lambda: now) if now is not None else (lambda: dt.datetime.now(dt.timezone.utc))
    now = clock()
    end = now.date().isoformat()
    start = (now.date() - dt.timedelta(days=config["lookbackDays"])).isoformat()
    old = {r["cik"]: r for r in (previous or {}).get("companies", [])}
    companies, failures = [], 0
    deadline = time.monotonic() + 1200
    for target in config["companies"]:
        base = {**target}
        try:
            if time.monotonic() > deadline:
                raise TimeoutError("Collection budget exhausted")
            filings = collector(target, start, end, config["maxFilings"])
            stamp = clock().isoformat().replace("+00:00", "Z")
            base["attemptedAt"] = stamp
            base.update(status="ok", fetchedAt=stamp, coverageFrom=getattr(filings, "coverage_from", start), coverageTo=end, filings=filings)
        except Exception:
            # Never log upstream text, identity credentials, or replace a failure with empty success.
            failures += 1
            base["attemptedAt"] = clock().isoformat().replace("+00:00", "Z")
            prior = old.get(target["cik"])
            if prior and prior.get("cik") == target["cik"] and prior.get("fetchedAt"):
                base = {**copy.deepcopy(prior), **base, "status": "stale"}
            else:
                base.update(status="unavailable", fetchedAt=None, coverageFrom=None, coverageTo=None, filings=[])
        companies.append(base)
    return {"version": 1, "source": "SEC EDGAR", "collector": "EdgarTools 5.62.1", "attemptedAt": clock().isoformat().replace("+00:00", "Z"),
            "lookbackDays": config["lookbackDays"], "maxFilings": config["maxFilings"], "companies": companies, **({"universe": config["universe"]} if "universe" in config else {})}, failures


def atomic_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False, encoding="utf-8") as stream:
        temp = Path(stream.name)
        json.dump(data, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    temp.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "public/data/sec-filings.json")
    args = parser.parse_args()
    # Configure the limiter before importing EdgarTools; a real contact is required.
    identity = os.environ.get("EDGAR_IDENTITY", "Anthracite yechan030102@gmail.com")
    if not re.search(r"[^\s@]+@[^\s@]+\.[^\s@]+", identity):
        raise ValueError("EDGAR_IDENTITY needs a contact email")
    os.environ["EDGAR_IDENTITY"] = identity
    os.environ["EDGAR_RATE_LIMIT_PER_SEC"] = "2"
    from edgar import set_identity
    set_identity(identity)
    config = json.loads((ROOT / "config/sec-monitor.json").read_text())
    previous = json.loads(args.output.read_text()) if args.output.exists() else None
    data, failures = refresh(config, previous)
    atomic_write(args.output, data)
    print(f"SEC monitor: {len(data['companies']) - failures} confirmed, {failures} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
