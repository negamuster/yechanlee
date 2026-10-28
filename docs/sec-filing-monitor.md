# SEC filing monitor

## Scope and completion criteria

An hourly GitHub Actions Python batch uses **EdgarTools 5.62.1 (MIT)** to collect public filing metadata for the eight CIKs in `config/sec-monitor.json`. The browser reads the published `/data/sec-filings.json`; no Python Vercel function or paid API is required. The `/filings` page provides company, form (including amendments), and local watchlist filters. Stock pages show only their own CIK's published records. Desktop/mobile controls must remain usable during source failures.

Initial universe: AAPL, MSFT, NVDA, AMZN, GOOGL, META, TSLA and SATL. This is a public configured universe, not all SEC issuers. Browser watchlists are never uploaded or used to add server-side targets. Unsupported symbols are explicitly identified. Form 4, 13D/G, filing-body extraction, event classification, email/push notifications and user-specific server scheduling are outside this first version.

## Collection and data rules

- Query fixed CIKs with `Company(cik).get_filings(...)`, not ticker guesses or accession prefixes. An accession's first digits can belong to a filing agent; source URLs use the target company's verified CIK.
- Collect 10-K/Q, 8-K, 20-F, 40-F, 6-K and `/A` amendments within 180 UTC calendar days, up to 40 most recent matching records per company. Original/amended filings remain separate accession identities. Sorting uses SEC filing date descending, then accession; it does **not** assert acceptance-time ordering.
- Disable full historical loading. Check that the recent submissions metadata reaches the requested coverage start before accepting a result. Insufficient history, identity mismatch, invalid dates and conflicting accessions are failures, not successful empty results.
- Only metadata is fetched: no filing body, hidden header scrape, XBRL download or additional request per filing. Report date can be absent; do not infer it from filing date. Dates remain SEC date labels. The receipt timestamp is recorded after each successful collection, independently of a later batch attempt.
- Require an identified contact (`EDGAR_IDENTITY`, default existing Anthracite public contact) and set `EDGAR_RATE_LIMIT_PER_SEC=2` before importing EdgarTools. Batch is sequential, bounded by the workflow's 10-minute timeout, and scheduled at minute 17 hourly. GitHub may delay/skip scheduled runs; UI marks receipts older than six hours as delayed, including when no subsequent run succeeds.
- A per-company failure preserves only the same symbol/CIK's previous filings, coverage and original receipt, marked stale. First failure has `unavailable`, null receipt/coverage and no confirmed records. Verified empty success clears old records. Old records are never described as a complete current window.
- Snapshot writes are atomic. Node/Zod validates dates, URL-to-CIK/accession equality, ordering, duplicate identity, statuses, coverage and configured identities before the workflow commits. Partial failure statuses are committed; the workflow still fails visibly. No raw upstream errors or credentials enter artifacts/logs.
- Refreshing the page re-reads the published batch, never triggers SEC collection. The shared resource cache retains the prior snapshot on transport/contract failure. Each company's receipt remains visible; source stale/unavailable and network failure remain distinct.

## Development and verification

```sh
python -m venv .venv
.venv/bin/pip install -r requirements-edgar.txt
.venv/bin/python -m unittest discover -s tests -p 'test_sec_monitor.py'
# Live, read-only SEC collection, excluded from unit tests:
.venv/bin/python scripts/refresh-sec-filings.py
node scripts/validate-sec-filings.mjs
npm run verify
npm run test:e2e
```

The committed snapshot supports Vite dev and static preview without Python or SEC access. Only the collector and its adapter tests need Python; CI installs the pinned package. Automated regression uses synthetic filings, fixed timestamps and mocked transport; a live source comparison is separate evidence. Existing portfolio/financial/chart calculations and saved-record schemas are unchanged. The hourly workflow activates only after main merge; PR preview does not imply scheduled operation or production rollout.

During implementation, the installed EdgarTools collector returned 62 metadata records across eight configured CIKs. A separate direct SEC AAPL submissions request matched its four in-window accessions exactly, including an amended filing submitted through another CIK. This is extraction/identity verification, not confirmation that the filing itself is accurate.

## Primary sources

- [EdgarTools library and MIT license](https://github.com/dgunning/edgartools)
- [Pinned PyPI release](https://pypi.org/project/edgartools/5.62.1/)
- [Company filing API](https://edgartools.readthedocs.io/en/latest/api/company/)
- [SEC access guidance, date and accession meanings](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data)
- [SEC timestamp definitions](https://www.sec.gov/about/webmaster-frequently-asked-questions)
