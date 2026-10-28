# SEC filing monitor

## Scope and completion criteria

An hourly GitHub Actions Python batch uses **EdgarTools 5.62.1 (MIT)** to collect public filing metadata for the configured CIKs in `config/sec-monitor.json`. The browser reads the published `/data/sec-filings.json`; no Python Vercel function or paid API is required. The `/filings` page provides company, form (including amendments), and local watchlist filters. Stock pages show only their own CIK's published records. Desktop/mobile controls must remain usable during source failures.

Current universe: S&P 500 and Nasdaq 100 constituent snapshot plus SATL (see dated expansion below). This is a public configured universe, not all SEC issuers. Browser watchlists are never uploaded or used to add server-side targets. Unsupported symbols are explicitly identified. Form 4, 13D/G, filing-body extraction, event classification, email/push notifications and user-specific server scheduling are outside this first version.

## Collection and data rules

- Query fixed CIKs with `Company(cik).get_filings(...)`, not ticker guesses or accession prefixes. An accession's first digits can belong to a filing agent; source URLs use the target company's verified CIK.
- Collect 10-K/Q, 8-K, 20-F, 40-F, 6-K and `/A` amendments within 180 UTC calendar days, up to 40 most recent matching records per company. Original/amended filings remain separate accession identities. Sorting uses SEC filing date descending, then accession; it does **not** assert acceptance-time ordering.
- Disable full historical loading. Check that the recent submissions metadata reaches the requested coverage start before accepting a result. Insufficient history with older SEC archive references, identity mismatch, invalid dates and conflicting accessions are failures, not successful empty results.
- Only metadata is fetched: no filing body, hidden header scrape, XBRL download or additional request per filing. Report date can be absent; do not infer it from filing date. Dates remain SEC date labels. The receipt timestamp is recorded after each successful collection, independently of a later batch attempt.
- Require an identified contact (`EDGAR_IDENTITY`, default existing Anthracite public contact) and set `EDGAR_RATE_LIMIT_PER_SEC=2` before importing EdgarTools. Batch is sequential, bounded by the workflow's 30-minute timeout and a 20-minute request-start budget, and scheduled at minute 17 hourly. GitHub may delay/skip scheduled runs; UI marks receipts older than six hours as delayed, including when no subsequent run succeeds.
- A per-company failure preserves only the same CIK's previous filings, coverage and original receipt, marked stale. First failure has `unavailable`, null receipt/coverage and no confirmed records. Verified empty success clears old records. Old records are never described as a complete current window.
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

During the original eight-company implementation, the installed EdgarTools collector returned 62 metadata records across eight configured CIKs. A separate direct SEC AAPL submissions request matched its four in-window accessions exactly, including an amended filing submitted through another CIK. This is extraction/identity verification, not confirmation that the filing itself is accurate.

## Primary sources

- [EdgarTools library and MIT license](https://github.com/dgunning/edgartools)
- [Pinned PyPI release](https://pypi.org/project/edgartools/5.62.1/)
- [Company filing API](https://edgartools.readthedocs.io/en/latest/api/company/)
- [SEC access guidance, date and accession meanings](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data)
- [SEC timestamp definitions](https://www.sec.gov/about/webmaster-frequently-asked-questions)


## Index universe expansion (2026-10-28)

The checked constituent snapshot contains S&P 500: 503 securities / 500 issuers;
Nasdaq 100: 101 securities / 100 issuers. Their union is 515 CIKs; the existing
additional SATL target is retained, for 516 collectors. Share classes (including
GOOG/GOOGL, FOX/FOXA, NWS/NWSA) share one filing list and one SEC request sequence.
`aliases` supports search, saved-stock filtering and individual stock routes.

Membership sources are the two Wikipedia constituent lists linked in
`config/sec-monitor.json` → `universe.sources`; this is a reviewed secondary-source
snapshot, not a licensed official index feed or an ETF proxy. All S&P CIKs were
cross-checked where SEC ticker mappings exist, with no conflicts; Nasdaq-only CIKs
were resolved through SEC `company_tickers.json`. The snapshot check date is
separate from each SEC receipt. The UI explicitly says later index additions and
removals require review; hourly filing collection does not refresh membership.
To update membership, compare the source lists, verify SEC identities, regroup
aliases by CIK and revalidate per-index counts, then collect and review the
config + public snapshot together in a PR. Never update the membership date merely
because an hourly filing fetch succeeded. Preserve SATL as `additional`.

The hourly sequential collector still uses EdgarTools at two requests per second.
The workflow now permits 30 minutes. A 20-minute request-start budget marks remaining
companies stale/unavailable while retaining each original receipt. An in-flight
request still uses the library's network timeouts; the workflow is the outer limit.
Failures remain visible. A new CIK with an explicitly empty archive-file index
uses only the proven shorter coverageFrom date, which the UI labels as limited
and excluding predecessor CIK filings. An archive gap still fails closed. The published list renders 20 filings
at a time and collapses per-company collection details for large selections.

Navigation now exposes calendar, filings, 13F and simulator individually between
macro and saved items. Desktop/tablet navigation wraps; mobile retains its bottom calendar link and the More page links to filings,
13F and simulator. CI tests cover those widths, index selection,
share-class lookup and the full 516-issuer metadata shape.
