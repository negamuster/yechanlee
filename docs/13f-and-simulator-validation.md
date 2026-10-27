# 13F verification and simulator calculations

Implemented 2026-09-23. Validation checks that our parsed values match the submitted SEC records; it is not an SEC endorsement or confirmation that a filer made no mistakes.

## 13F

- Use the SEC submissions feed and raw filing XML. Select the latest report period, not simply the most recently amended older quarter. Keep report date, filing date, and acceptance ordering distinct.
- Include 13F-HR/A: RESTATEMENT replaces the period's earlier rows; NEW HOLDINGS appends new entries. Unknown amendment types fail closed.
- Check every consumed information-table file's combined raw row count and dollar sum against the filing cover summary, before filtering options or principal-denominated positions. Mismatches are not published as verified.
- Values filed before 2023-01-03 are thousands of dollars; newer filings use dollars. The filing date controls the conversion, including amendments to old quarters.
- Group by normalized CUSIP and SH/PRN type, not issuer name or the descriptive class title (which varies by filer). Different share classes have different CUSIPs. Compare only the immediately previous quarter with the same security identity. If unavailable, show unknown, not a new holding.
- Chart, table percentages and center total use all included holdings. The API returns every eligible SH position with `holdingsComplete: true`, `holdingCount` and verified aggregate totals; the browser rejects truncated responses. The table searches/sorts the full dataset, renders 50 rows per page, and exports all filtered rows. The chart has top ten and Other; tiny Other slices are retained. Options and PRN values are disclosed separately, so the displayed sum is not full 13F reported value or AUM.
- Selected institution loads first. Recheck while visible every 15 minutes, when switching institutions, on return to tab, or on refresh. Server uses a maximum 15-minute success cache and coalesces concurrent requests. No cron or background collection while nobody visits. On upstream/validation failure, keep and label last verified instance-local data; cold instances may have no fallback. Subsequent submissions need no deployment.
- SEC requests are paced to four starts/second within each instance. This is not a distributed quota; large-scale traffic would need a shared cache/queue.
- Raw XML format required; unsupported formats or uncertain amendments show an error rather than guessed data. Review a notice-only filer if it changes reporting entity; the registry cannot infer all future reorganizations automatically.

### Full holdings and institution comparison (2026-10-22)

- Current positions and previous-only positions are separate arrays. Only a successfully verified exact preceding quarter permits new/increased/decreased/unchanged/previous-only classification. Failed previous-quarter verification yields unknown, never fabricated exits or new holdings. Previous source links are retained in CSV.
- The comparison view joins two institutions on CUSIP at an identical reporting period. Each percentage uses that institution's full included total. Absent entries are labeled unreported, not a failure-derived zero. Missing/failed period requests block the comparison and CSV; refresh failures with an existing verified same-period response retain it with a stale label.
- `period=YYYY-MM-DD` accepts quarter-end dates. Selection is limited to the latest eight calendar quarters relative to the institution's latest public HR period. Metadata scans at most five archive feeds. The UI offers the intersection of discovered available periods; missing periods return 404, never a fallback to latest. Success cache, in-flight coalescing and failure backoff are scoped to CIK plus requested period.
- CSV includes CIK, report/filing dates, source links, full USD numbers, share counts and stale status. UTF-8 BOM supports Korean text; CUSIP/CIK are explicitly text identifiers to preserve leading zeros in spreadsheets. Upstream text is quoted and spreadsheet formula prefixes are escaped.
- Differences between public quarterly snapshots do not establish trades: splits, other corporate actions, confidentiality and amendments may affect them. No ticker-to-CUSIP guesses or aggregation by issuer name are used. The default table includes all non-option SH positions; options and principal-denominated entries remain excluded and disclosed. It is not full AUM.
- SEC basis: [reporting scope, deadlines and amendment treatment](https://www.sec.gov/rules-regulations/staff-guidance/frequently-asked-questions-about-form-13f), especially FAQs 7–8, 25 and 58b–58d. Existing XML summary verification and amendment ordering remain in force.
- Regression checks: `node --test tests/filing-dates.test.mjs tests/form13f-full.test.mjs tests/form13f-presentation.test.mjs tests/tool-pages.test.mjs`; `tests/e2e/form13f.spec.mjs` covers desktop/mobile pagination, full filtered CSV, quarter alignment and a failed historical-period retry.

### Registry corrections

| Institution | Old CIK | Corrected CIK / behavior |
| --- | --- | --- |
| Citadel Advisors | 1423298 (DFJ Athena Partners) | 1423053 |
| Appaloosa | 1418736 (Campbell Opportunity Timber Fund) | 1656456 |
| BlackRock | 1364742 (BlackRock Finance, last HR 2024 Q2) | 2012383 |
| Pershing Square | 1336528 (newer filings are notices) | 2026053 (Pershing Square Inc.) |
| Vanguard Group | 102909 | Historical group records explicitly labeled; current filings split across managers. Do not replace the group with one subsidiary and label it as the entire group. |
| Scion | 1649339 | Latest found report 2025 Q3; historic/stale report warning. |

All 14 original CIKs were checked against SEC submissions metadata. This is distinct from complete holding-level verification for every institution.

### Real XML samples

Original SEC XML downloaded on 2026-09-23 and run through the same parser/collector:

| Institution | Report period | Accession | Raw rows | Verified reported total USD |
| --- | --- | --- | ---: | ---: |
| Berkshire Hathaway | 2026-06-30 | 0001193125-26-352200 | 89 | 299,253,556,246 |
| Pershing Square Inc. | 2026-06-30 | 0001172661-26-003790 | 15 | 19,465,692,772 |
| Citadel original | 2026-06-30 | 0001104659-26-097200 | 16,127 | 875,096,281,441 |
| Citadel restatement | 2026-06-30 | 0001104659-26-104387 | 16,122 | 875,011,794,337 |

After Citadel's restatement, the included SH positions total $171,755,808,876; excluded options/PRN total $703,255,985,461. The raw summary includes both. Berkshire aggregates to 29 security/class identities and Pershing to 14. Prior quarters for these three samples also loaded and verified successfully.

Berkshire raw cover/table fixtures are committed for repeatable tests. For the larger sample collection run `python scripts/fetch-sec-fixtures.py`, then `node scripts/verify-sec-fixtures.mjs`. Large downloaded raw files stay local; `tests/fixtures/sec/verification-report.json` records the comparison results and exact original URLs.

Official references:
- https://www.sec.gov/Archives/edgar/data/1067983/000119312526352200/0001193125-26-352200-index.htm
- https://www.sec.gov/Archives/edgar/data/2026053/000117266126003790/0001172661-26-003790-index.htm
- https://www.sec.gov/Archives/edgar/data/1423053/000110465926104387/0001104659-26-104387-index.htm
- https://www.sec.gov/Archives/edgar/data/2100119/000210011926001527/0002100119-26-001527-index.htm
- https://www.sec.gov/Archives/edgar/data/102909/000010290926002714/xslForm13F_X02/primary_doc.xml
- https://www.sec.gov/rules-regulations/staff-guidance/division-investment-management-frequently-asked-questions/frequently-asked-questions-about-form-13f

## Simulator

For each year, show beginning-of-year gross assets, debt, funding gap and net worth. Apply the initial allocation-weighted return to gross invested assets only, assuming annual rebalancing; a zero initial portfolio has zero return. Add year-end income minus consumption, interest and scheduled principal. Stop income from retirement age onward.

Interest = opening debt × its own interest rate. Principal repayment is capped at the debt balance and reduces assets and debt equally; principal itself is not a loss of net worth. Paid-off loans generate no further interest.

If resources are insufficient, set invested assets to zero and disclose an accumulated funding gap. Subtract the gap from net worth; later surplus first offsets it. The gap assumes no extra interest and does not establish availability of new credit. Negative balances never receive investment returns. Show negative net worth amounts instead of hiding them with a dash. Consumption excludes separately entered debt servicing to avoid double-counting.

The model ignores taxes, fees, market volatility, sale constraints and actual mortgage schedules; annual principal is a user-specified simplifying assumption.

## Verification commands

`node --test tests/financial-math.test.mjs tests/filing-dates.test.mjs`

`npm run build`

## Full holdings table (TanStack Table)

Only the institution's full holdings table uses `@tanstack/react-table` 9.3.1
(MIT). Institution comparison and the SEC collector retain their existing code.
The v9 sorting, visibility and pagination features are explicitly registered;
no additional table UI framework is installed.

- Default order remains raw USD value descending, with the original portfolio
  rank as the final tie breaker. Sort by up to three columns using the visible
  multi-sort button or Shift-click. Priorities and directions appear above the
  table; only the primary header has `aria-sort`.
- New positions and unavailable prior shares stay after numeric share changes
  in both directions. They are never assigned a zero/infinite change. Secondary
  sorting applies only when the earlier criterion ties.
- The name/class/CUSIP and evidence button column is always visible and pinned.
  Other columns can be hidden. Hiding an active sorting column removes that
  criterion; if none remains, use visible value descending or name ascending.
- Search, quarter-change filters and full-portfolio weights retain their existing
  semantics. Fifty rows render per page. Search/filter/sort changes reset to the
  first page; a new receipt or smaller response cannot strand an empty page.
- CSV retains the existing schema, raw numeric precision, leading-zero identifiers,
  formula protection, reporting periods, stale flag and current/prior SEC links.
  It includes all matched rows in the current sort order and every export column,
  regardless of pagination or column visibility. The UI states this explicitly.
- Reset restores the default order, all columns, current holdings, empty search,
  single-sort interaction and page one. Changing institution remounts the table
  and clears its view settings. No browser storage or financial records migrate.

Regression coverage: `tests/holdings-table-ui.test.mjs` mounts the real component
in jsdom; `tests/e2e/form13f.spec.mjs` exercises desktop and Pixel 7 Chromium
emulation with synthetic filings. The existing 13F parsing, presentation,
institution comparison and evidence tests remain applicable.
