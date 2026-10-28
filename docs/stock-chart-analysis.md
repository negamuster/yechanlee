# Chart analysis overlays

Scope: optional 20/50-bar simple moving averages and VOO price-change comparison
on the existing Lightweight Charts 5.2.1 stock chart. No package, provider, API key,
server endpoint or stored user-record format changes.

Completion: overlays, keyboard/readout/table and source status agree; existing
pan/zoom/refresh anchors and price/OHLCV behavior remain intact; disabled comparison
makes no VOO requests. Node, desktop/mobile Chromium and independent review cover
calculation, missing/late/mismatched responses and interaction regressions.

SMA includes the current close and exactly N-1 preceding returned closes. The
first N-1 observations have no SMA. It uses the full fetched period before viewport
cropping. Labels say bars: 20 five-minute bars are not 20 days. Missing source bars
are not synthesized. No hidden longer-history request is made for warm-up.

Comparison uses the existing Yahoo chart API for VOO only after explicit selection.
Require matching requested period, reported interval and currency. Use exact common
timestamps, never nearest dates/interpolation/carry-forward. Each series starts at
0% at its own close at the first common timestamp; the difference is percentage
points. This is price change, not dividend-reinvested total return or the existing
1D/YTD header baseline. Common coverage/basis and independent VOO receipt/stale
status are disclosed. Missing comparison leaves the price chart usable.

The primary bar grid stays unchanged when switching percent/price presentation,
so zoom ranges keep their original timestamp anchors. Percent comparison uses
lines and hides candles, volume and price SMAs; their preferences return in price
view. Raw OHLCV, derived values and missing values remain available in the table.

References:
- https://tradingview.github.io/lightweight-charts/tutorials/demos/moving-average
- https://tradingview.github.io/lightweight-charts/tutorials/demos/compare-multiple-series
- https://tradingview.github.io/lightweight-charts/docs/api/interfaces/PriceFormatCustom
