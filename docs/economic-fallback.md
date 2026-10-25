# Economic collection fallback

Base: `2f4f8d81831005df6dea4547d9925f35dd5d1f14`.

## Goal and completion conditions

Keep BLS as the first source for CPI-U all items (CUUR0000SA0, monthly, not seasonally adjusted, index 1982–84=100) and U-3 unemployment (LNS14000000, monthly, seasonally adjusted, percent). When a monthly series fails collection or validation, retrieve the same BLS statistic through FRED's public CSV: CPIAUCNS / UNRATE. EFFR remains on the New York Fed API.

- Validate series identity, dates, missing values, history coverage, units/adjustment mapping and non-regression before replacing data. Never turn missing data into zero or replace an independently successful BLS series with fallback data.
- Fetch FRED once, only when needed, for both monthly series. Retain bounded retries and provider Retry-After behavior. No new key, dependency, schedule or permission.
- Record the successful retrieval route separately from the latest BLS/fallback failure. Successful fallback clears the effective collection error, records the real FRED receipt time and keeps the BLS failure as a warning. Both failures preserve all prior observations, collection time and retrieval route; only attempt/diagnostics advance.
- Accept existing v1 snapshots. The source display says BLS statistics via FRED when applicable, with both series IDs/links. Observation freshness and retrieval route remain separate; an old FRED observation cannot become fresh just because it was downloaded today.
- A complete valid fallback is an operational warning, not a failed collection. Any series that cannot be collected through its available routes still fails the workflow. Always publish independent successes as before.

## Validation

Focused parser/collector/report regressions cover direct success without FRED, partial-series fallback, transient errors, both routes failing, malformed/missing/duplicate/future data, rollback, provenance, legacy snapshots and return to BLS. Existing Node tests/build/lint plus desktop/mobile browser checks validate UI source/freshness/failure states. Independently review the integrated SHA. Live source collection and fixture tests are reported separately; main merge/production deployment remains a separate user request.

## Source basis and limits

- [FRED CPIAUCNS](https://fred.stlouisfed.org/series/CPIAUCNS): BLS CPI-U all items, monthly, not seasonally adjusted, index 1982–84=100. CPI YoY continues to compare the same calendar month one year earlier.
- [FRED UNRATE](https://fred.stlouisfed.org/series/UNRATE): BLS U-3, source code LNS14000000, monthly, seasonally adjusted, percent.
- The public CSV was reachable without a key on 2026-10-25; 81 observations per series matched the existing 2020–September 2026 BLS snapshot. This comparison is a dated observation, not a guarantee of future availability or simultaneous publication. FRED may lag a BLS release; CSV does not provide the BLS API's per-observation footnotes. Previously received BLS notes are retained as `priorNote` with their original raw value and receipt time, including when a FRED revision changes that value. They are shown as historical notes rather than attributed to a new FRED download. Direct BLS recovery supplies its own current notes again. The original source links remain available.

## Local evidence

- 2026-10-25 16:38 KST: the actual collector received BLS `http_503`, successfully downloaded FRED CSV, and exited 0 with two explicit source warnings. CPI/U-3 each retained 81 observations through September 2026 and EFFR retained 1,457 daily observations. No observation value changed from the base snapshot. All three BLS historical notes were preserved with their original values and 2026-10-24 05:01 KST receipt. The committed snapshot contains the successful FRED/NY Fed receipt at `2026-10-25T07:38:19.766Z`, not a fabricated BLS success time.
- `npm run verify`: zero lint errors/warnings, 432 Node tests passed and TypeScript/production build passed. Existing build chunk-size warnings remain.
- `npm run test:e2e -- --list`: 70 desktop/mobile cases discovered. The local Chromium download limitation remains; actual CI/browser outcomes and independent review SHA are recorded in the PR separately.
- The script exposes BLS/FRED/effective failure codes and retrieval route in console/GitHub warning annotations and a step-summary table. A verified fallback is WARN with exit 0; collection failure through both routes remains exit 1. The data-health checker also warns on FRED retrieval, so a healthy payload does not hide the primary-source outage.
