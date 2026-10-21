# Economic indicators dashboard

`/indicators` retains the official guides and adds three US indicators. Apache ECharts 6.1.0 (Apache-2.0) is imported through its modular core with LineChart, grid, tooltip, ARIA and SVG renderer. The route is lazy loaded; no chart package is added to other pages. Native selection controls and a paginated observation table provide keyboard and screen reader access without relying on pointer tooltips.

| Indicator | Official series | Basis | Comparison |
| --- | --- | --- | --- |
| CPI YoY | BLS CUUR0000SA0 | Monthly CPI-U all items, NSA; index 1982–84=100 | `(index / index in same month last year - 1) * 100`; prior month difference in percentage points |
| Unemployment | BLS LNS14000000 | Monthly civilian U-3 unemployment, age 16+, SA, percent | Prior month, percentage points |
| Effective federal funds rate | New York Fed EFFR | Daily business-day rate, NSA, percent; volume-weighted median | Previous provided business day, percentage points |

EFFR is not the FOMC target range or a monthly average. CPI YoY is calculated by Anthracite from official raw indices and displayed to two decimal places; it can differ in precision from BLS's one-decimal news release. Observation periods are not publication dates. The dashboard does not invent release timestamps, forecasts, consensus, or initial-release vintages. History may include official revisions and provider footnotes.

## Collection and delivery

- No new API key is needed. The BLS documented v1 API returns both monthly series in **one POST per daily collection**; seven calendar years fit its ten-year limit and include CPI's prior-year base. Its unregistered limit is 25 queries/day. NY Fed's documented Markets Data API supplies EFFR history in one GET.
- `.github/workflows/refresh-economic-indicators.yml` runs daily at 16:31 UTC, manually, and on relevant main source changes. It validates the parsers, downloads data, atomically replaces `data/economic-indicators.json`, commits and rebases before push. GitHub scheduled jobs may be delayed. This is daily collection, not intraday streaming or guaranteed publication-time delivery.
- Run `node scripts/refresh-economic-indicators.mjs` to collect manually. Per-series failures retain the original observations and `collectedAt`, record the failed `attemptedAt`, and cause a failing workflow conclusion. The workflow still saves other successful series. A malformed previous file is not silently discarded.
- `/api/economic-indicators` reads a fixed allowlisted main snapshot URL, caches checks for 15 minutes, coalesces concurrent requests, and falls back to the bundled verified snapshot. It does not call BLS per visitor or need a new deployment to see a daily snapshot. It rejects arbitrary query parameters and unsupported methods. Remote snapshots cannot roll back collection/attempt timestamps; regressed or malformed provider histories cannot overwrite a successful series.
- Client foreground refresh: 15-minute stale time, 30-minute cadence; hidden/offline tabs pause through the shared policy. The refresh button checks the site's collected snapshot and does not force an upstream data collection.
- The source's collection time is distinct from response or cache receipt time. Collection failure, age over 48 hours, or observations over 75 days old (monthly) / 7 days old (EFFR) produces a delay notice. Collection over 30 days old is hidden. Partial source failures leave other series usable; all unavailable returns 503. Production health checks include the endpoint and name delayed sources.
- Source contracts reject wrong identities, duplicate/unsorted/impossible/future observation dates, invalid units/ranges, nonfinite values and future collection timestamps. Monthly missing values are explicit gaps; no zero filling, interpolation or comparison against a different calendar month. The 1Y / 3Y / 5Y windows use the latest observation period for each indicator.

## Sources and conditions reviewed

- BLS API signatures: https://www.bls.gov/developers/api_signature.htm
- BLS limits: https://www.bls.gov/developers/api_faqs.htm
- BLS conditions and required retrieval-date/derived-analysis notice: https://www.bls.gov/developers/termsOfService.htm
- CPI NSA 12-month changes: https://www.bls.gov/charts/consumer-price-index/
- New York Fed API: https://markets.newyorkfed.org/static/docs/markets-api.html
- EFFR definition: https://www.newyorkfed.org/markets/reference-rates/effr
- New York Fed reference-rate attribution/conditions: https://www.newyorkfed.org/privacy/termsofuse
- ECharts modular imports: https://echarts.apache.org/handbook/en/basics/import/

Provider attribution, collection date and conditions links are visible in the dashboard. No provider logo or endorsement is implied. FRED was considered; its public CSV downloads returned HTTP 404 during this work and no FRED API key was configured, so this implementation uses the originating institutions' documented APIs instead of scraping FRED pages.

## Validation

`node --test tests/*.test.mjs`, `npm run build`, and `npm run test:e2e`. Browser scenarios cover desktop/mobile charts, selection/window changes, table values, layout containment, partial source failure, null calendar-month comparisons, retry, retained data and original source timestamps. Live API collection verifies connectivity independently of deterministic fixtures.
