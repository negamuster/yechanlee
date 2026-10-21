# Stock annual financials and chart periods

## Annual financials

The discontinued `/vX/reference/financials` request was removed from the browser and stock proxy allowlist. Massive [ended this experimental API on June 22, 2026](https://massive.com/changelog). Its successor fundamentals products may require a separate entitlement; the site now uses public [SEC EDGAR Company Facts](https://www.sec.gov/search-filings/edgar-application-programming-interfaces), without a new subscription or API key.

`/api/stock-financials?ticker=...` resolves the symbol using SEC's company ticker list and checks the returned CIK. It extracts the latest two annual periods from standard US GAAP or IFRS facts in 10-K, 20-F, 40-F and amendments. Annual durations must be 300–400 days; quarterly, nine-month, multi-year and future-filed records are excluded. Fields in each row share the same fiscal period, taxonomy and filing accession. Balance-sheet values match the period end. Conflicting units/values and unsupported custom tags remain missing. Comparative periods use their actual start/end dates, not a later filing's `fy` label. Both namespaces are considered when a company changes standards.

The UI distinguishes no standard annual coverage from retrieval failure, shows fiscal dates, filing date, accounting standard and a link to the original filing. Losses and zero values are preserved. Annual figures are not TTM. Reported EPS may not reflect subsequent splits; P/E, ROE and other ratios retain the stated currency/period checks, and revenue growth requires consecutive annual periods. Missing fields are never filled with estimates.

Requests are paced, deduplicated and cached (six hours in an instance, one hour at the CDN). Refresh failures can retain the original collected annual data with a stale indication, including the browser's last confirmed snapshot. A new response without annual coverage clears the old data rather than being treated as a failure. The source collection timestamp stays separate from fiscal/filing dates. Only fixed SEC URLs can be fetched; method, same-site, symbol and rate guards apply.

## Price chart

`/api/stock-chart?ticker=...&period=...` fetches Yahoo Finance chart data. The header price, daily high/low and one-year statistics continue using Polygon/Massive completed daily bars. The chart identifies its separate source and observation times; it is not described as real-time or as a dividend-inclusive total return.

| Button | Chart observations | Return baseline |
| --- | --- | --- |
| 1D | Latest provided session, 5-minute bars | Confirmed previous close when available |
| 5D | Latest five observed sessions, 30-minute bars | First displayed price |
| 1M | One month, daily bars | First displayed price |
| 6M | Six months, daily bars | First displayed price |
| YTD | Current year, daily bars | Last confirmed prior-year close (within seven days of year end), otherwise explicitly labelled first available price |
| 1Y | One year, daily bars | First displayed price |
| 5Y | Five years, weekly bars | First displayed price |
| ALL | All returned history, weekly bars | First displayed price |

ALL uses explicit epoch-to-now bounds to avoid Yahoo's `range=max` quarterly downsampling. Actual returned granularity is displayed. ALL is the provider's available history, not a guarantee of complete history since listing. Current bars can change. Missing/future/invalid prices are omitted, without zero fills or invented sessions. YTD's prior-year baseline is excluded from the displayed current-year series. Intraday labels include ET times; long-period labels include years. The eight buttons form a four-column grid on mobile.

Chart requests are bounded to the configured period registry, deduplicated and cached by symbol and period. Class shares map dots to Yahoo dashes, and upstream symbol identity is checked. Refresh failure retains only the same symbol/period's prior chart and original receipt time. A period or symbol change immediately hides the old series; late requests cannot overwrite the new chart. Both APIs are wired into Vite local development and Vercel handlers.

## Validation

Unit tests cover fiscal contexts, restatements, units, accounting-standard changes, annual/TTM exclusion, input guards, cached failures, all eight chart queries, intraday timestamps, five trading sessions, YTD baseline, long history and class shares. Mounted component tests cover period selection, keyboard chart navigation, SEC filing links, source timestamps, missing annual coverage and late-response isolation. Live read-only checks fetched AAPL/NVDA/SATL Company Facts and Yahoo intraday/weekly history; parsing produced dated annual rows and genuine chart observations. These checks do not replace production verification after deployment. Native browser layout/touch QA was unavailable in this environment.
