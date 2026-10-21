# Stock chart controls

The eight existing source periods (`1D`, `5D`, `1M`, `6M`, `YTD`, `1Y`, `5Y`, `ALL`) retain their Yahoo query, return baseline and granularity. The stock-detail chart now uses TradingView Lightweight Charts 5.2.1 (Apache 2.0). Chart rendering is separate from market-data sourcing: prices remain Yahoo Finance, not TradingView quotes. This change does not add a provider key, subscription or a new upstream request per gesture.

## Interaction

- Mouse wheel and touch pinch zoom horizontally; dragging pans. Explicit zoom, older/newer movement, latest-window and full-window buttons provide equivalent controls. Price axes auto-scale to the visible data. Vertical touch gestures remain available for page scrolling through `touch-action: pan-y`; touch tracking exits on touch end so a prior chart gesture does not trap the next page scroll. Native browser page pinch is excluded within the chart while the chart handles two-finger zoom.
- `←` / `→` select observations; `Home` / `End` select first/last and bring them into view; `+` / `−` zoom, `PageUp` / `PageDown` pan, and `0` restores the full fetched period. The focusable frame describes the shortcuts.
- Line/candle and volume preferences survive source-period and stock changes within the detail view. A new stock/period starts with its full data range. Controls do not fetch extra bars beyond the selected source period.
- Once a user changes the viewport, refreshes restore its timestamp anchors rather than treating a prior array index as the same date. Append, prepend and rolling-window changes are handled by `chartViewport.ts`. Observations outside a newly reduced source history cannot be retained. Full-window reset resumes fitting new data. Existing request identity checks continue preventing late responses from changing the selected stock/period.
- The readout shows the selected actual timestamp, close, open/high/low and volume. Dates retain `Oct 20, 2026`; intraday readouts include 24-hour ET time. Axis formatters also use ET rather than interpreting raw Yahoo timestamps as UTC wall time.
- An expandable table contains the current visible observations, latest first, twelve per page. Keyboard controls, readout and table also work when Canvas is unavailable. All data are React text, not injected HTML.

## OHLCV contract and gaps

The chart endpoint reads `open`, `high`, `low`, `close`, and `volume` from the same quote array index/timestamp. It keeps the original source timestamps and does not fabricate time slots or candles. OHLC is included only when all three additional fields are positive finite numbers, `high >= max(open, close, low)` and `low <= min(open, close)`. Missing/invalid OHLC leaves a usable close-only point. The client renders candle whitespace for those observations and offers the close line/table. Volume must be a nonnegative safe integer; zero is valid and missing volume is omitted, never zero filled. Missing volume renders whitespace, independently of OHLC availability. A dataset with no OHLC or volume disables the corresponding control and explains coverage.

Optional fields keep cached older close-only API responses compatible. The shared API/browser/production-health contract rejects partial OHLC triples, impossible candle ranges, negative/fractional/nonfinite volume, ordering errors, wrong identities and future observations. Health checks name OHLCV gaps as warnings while preserving usable close data. The source request guard, single-flight/cache, stale receipt timestamps and partial-page failure behavior remain in force.

Candles use green for close >= open and red for close < open. Volume uses the same direction when open is known. It does not label zero/missing volume as a market gain or loss. Current/incomplete bars may change, intervals are provider aggregates, and the chart is not a dividend-inclusive total return. VOO comparison and technical-indicator overlays are outside this implementation.

## Attribution and validation

The package is imported only by the lazy stock-detail route. Its built-in TradingView attribution remains enabled; the chart footer links TradingView and includes creator attribution, the unmodified v5.2.1 NOTICE and Apache license under `/licenses/`. The NOTICE's copyright year is preserved as published.

Primary references:
- https://tradingview.github.io/lightweight-charts/docs/api/interfaces/HandleScaleOptions
- https://tradingview.github.io/lightweight-charts/docs/api/interfaces/HandleScrollOptions
- https://tradingview.github.io/lightweight-charts/docs/api/interfaces/ITimeScaleApi
- https://github.com/tradingview/lightweight-charts/tree/v5.2.1

Validation: the Node suite covers real parser/schema paths, OHLCV gaps/zero volume, timestamp-anchored viewports, bounds and prior mounted detail regressions. Browser scenarios cover Canvas rendering, buttons and keyboard, line/candle/volume changes, matching/paginated tables, mobile containment, source failure/refresh retention, and native wheel/touch pinch/drag. Read-only live checks separately confirmed AAPL 1D (79 bars), NVDA 1M (22), SATL ALL (293), each with complete returned OHLCV at collection time; these samples do not guarantee coverage for every ticker.
