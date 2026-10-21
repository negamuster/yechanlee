# Company financial history

The existing SEC Company Facts request now supplies up to five annual periods, eight discrete quarters, and one trailing-four-quarter period. No extra provider, API key, Python service or dependency is added. `results` remains the annual array for compatibility; `quarterly` and `ttm` are separate arrays. The stock page retains the annual valuation summary and adds a financial-history view with period switches, metric charts, a scrollable table and filing/calculation details.

## Normalization and calculations

- Map standard US GAAP and IFRS revenue, operating income, operating cash flow and asset-purchase concepts. Custom/company-specific tags are not guessed. Preserve reported currency, zero and losses.
- Prefer total `Revenues` to a customer-contract revenue subtotal. If a non-contract revenue component is reported in the same filing/period but no total is available, leave contract revenue unconfirmed rather than present it as total revenue. A missing total-revenue YTD prefix must not silently fall back to a contract-revenue difference.
- Annual duration: 300–400 days in 10-K/20-F/40-F or amendments. Quarter duration: 70–110 days. Dates determine periods; a comparative fact's filing `fy`/`fp` label is not treated as its own fiscal period.
- Select an accession for each period. Do not fill missing fields from superseded accessions. A later filing repeating only unchanged comparative values may retain the complete original-quarter filing. Changed comparative facts use the later filing and flag the change.
- Direct three-month income facts remain direct. Derive Q2/Q3 cash flow only from a YTD total and a matching prior YTD prefix. Derive Q4 from the annual total minus a matching nine-month prefix. Exact fiscal start, adjacency, concept and currency must agree. Later unchanged repetitions do not invalidate the operand; later changed values and conflicting amendments block cross-filing differences. EPS is never derived by subtraction.
- Capex prefers cash payments for PPE. When absent, US GAAP `PaymentsToAcquireProductiveAssets` supplies the reported broader purchase total. Every Capex/FCF value carries its scope (`ppe` or `productive_assets`), displayed in the table and audit details. Scope changes cannot be subtracted or combined into TTM. Do not use absolute values to hide a negative purchase fact, add separate overlapping totals or substitute total investing cash flow.
- FCF = operating cash flow − Capex. This is the site's calculation, not the issuer's adjusted FCF. Broader productive-asset purchases can include intangibles/other productive assets. Different purchase scopes or currencies disable trend comparisons rather than imply comparability.
- TTM sums four consecutive, nonoverlapping, same-standard discrete quarters. Each metric requires all four values in one currency and purchase scope; known changed/amended component values are excluded from TTM. Incomplete metrics remain missing. TTM EPS and point-in-time balance-sheet sums are not created.
- Keep each operand's original value, unit, dates, accession and filing URL. Label reported values, YTD differences, four-quarter sums, amendments and changed comparative facts. This is latest-available financial history, not a historical point-in-time backtest or assurance that all possible restatements are resolved.

## Failure handling and checks

The existing SEC fair-access queue, request deduplication and caching remain. Failed refreshes keep the same company's annual/quarterly/TTM arrays with the original SEC receipt timestamp and a retry control. Unsupported coverage, retrieval failure and successful empty results remain distinct. Foreign annual-only issuers do not receive synthetic quarters. No missing value becomes zero.

Shared Zod checks now validate the expanded shape, dates, sources, FCF arithmetic and TTM adjacency/sums. Production health checks report missing annual operating/cash-flow fields and missing quarter/TTM coverage as warnings. Browser fixtures block external traffic.

```sh
node --test tests/*.test.mjs
npm run build
npm run test:e2e
```

Regression cases cover YTD subtraction, Q4, cash losses, zero/negative Capex, currency/scope changes, missing quarters, amendments, changed/unchanged comparatives, IFRS coverage, invalid FCF/TTM and original timestamps during failed refreshes. Browser checks exercise annual/quarter/TTM switches, audit sources, mobile containment, coverage gaps and mixed-currency presentation.

## References and live development check

- [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces): Company Facts, standard entity-wide concepts, unit separation and variable fiscal calendars.
- [EdgarTools](https://github.com/dgunning/edgartools) and [multi-period analysis](https://edgartools.readthedocs.io/en/stable/guides/multi-year-financial-data-api/): design reference for period-separated statements. No upstream Python code is embedded.
- [NVIDIA Q2 FY2027 SEC release](https://www.sec.gov/Archives/edgar/data/1045810/000104581026000073/q2fy27pr.htm): property/equipment and intangible-asset purchase presentation.

During development, current SEC Company Facts responses for AAPL (CIK 320193), NVDA (1045810) and SATL (1874315) each produced five annual periods, eight quarters and one TTM row. All expanded responses passed the shared contracts. Full downloaded Company Facts payloads are temporary development inputs, not repository fixtures or new production downloads.
