# US sector performance

Adds a compact home heatmap and an expanded panel on `/equity`, using 11 Select Sector ETFs and VOO as a benchmark. The code is independently implemented; no Neuberg code is copied.

- Fixed server-side Yahoo Finance chart requests; no key or arbitrary symbol input.
- Daily closing price returns in USD, excluding dividends. This is not a total-return index or an intraday quote.
- Current daily candle excluded until 15 minutes after the reported regular-session end.
- 1D: preceding VOO session. 1W/1M: on or before 7/30 calendar days earlier. YTD: prior-year final close.
- Each ETF must have both exact VOO boundary dates. Missing observations remain null, never zero. Excess performance is an arithmetic difference in percentage points.
- API cache: five minutes; concurrent requests share one collection. Partial results identify unavailable ETFs; total failure returns 503 or an explicitly stale prior snapshot with no-store.
- Local Vite and deployed API share the same handler.

Validation: six unit tests cover dates, nulls, incomplete candles, partial/total failures, caching and methods. TypeScript and production build pass. Existing Tailwind directive warnings remain. Browser smoke test could not run because Chromium is unavailable in this environment. Live Yahoo/Vercel integration must be checked in the deployment preview; no live data validation is claimed.

UI update: home panel now precedes the live stream and movers list. Sector labels use English display names inspired by the supplied reference (the underlying ETF universe is unchanged). The benchmark is VOO, including upstream requests, date alignment and excess returns. The shared Arial-based UI font applies across pages and controls; the Anthracite brand retains Times New Roman.
