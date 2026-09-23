# 13F verification and simulator calculations

Implemented 2026-09-23. Validation checks that our parsed values match the submitted SEC records; it is not an SEC endorsement or confirmation that a filer made no mistakes.

## 13F

- Use the SEC submissions feed and raw filing XML. Select the latest report period, not simply the most recently amended older quarter. Keep report date, filing date, and acceptance ordering distinct.
- Include 13F-HR/A: RESTATEMENT replaces the period's earlier rows; NEW HOLDINGS appends new entries. Unknown amendment types fail closed.
- Check every consumed information-table file's combined raw row count and dollar sum against the filing cover summary, before filtering options or principal-denominated positions. Mismatches are not published as verified.
- Values filed before 2023-01-03 are thousands of dollars; newer filings use dollars. The filing date controls the conversion, including amendments to old quarters.
- Group by CUSIP, share class and SH/PRN type, not issuer name. Compare only the immediately previous quarter with the same identity. If unavailable, show unknown, not a new holding.
- Chart, table percentages and center total use all included holdings, even those outside the top-30 table. The chart has top ten and Other; tiny Other slices are retained. Options and PRN values are disclosed separately, so the displayed sum is not full 13F reported value or AUM.
- Selected institution loads first. Recheck while visible every 15 minutes, when switching institutions, on return to tab, or on refresh. Server uses a maximum 15-minute success cache and coalesces concurrent requests. No cron or background collection while nobody visits. On upstream/validation failure, keep and label last verified instance-local data; cold instances may have no fallback. Subsequent submissions need no deployment.
- SEC requests are paced to four starts/second within each instance. This is not a distributed quota; large-scale traffic would need a shared cache/queue.
- Raw XML format required; unsupported formats or uncertain amendments show an error rather than guessed data. Review a notice-only filer if it changes reporting entity; the registry cannot infer all future reorganizations automatically.

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
