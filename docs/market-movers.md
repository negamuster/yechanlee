# Market Movers

The home page places a ten-row ranking underneath Market Overview. The three
buttons select estimated dollar turnover, percentage gainers, or percentage losers.
Rows link to the existing stock detail page. This first version covers US-listed
securities, including ETFs; it does not claim common-stock-only coverage.

## Data and definitions

- Source: Polygon / Massive grouped daily aggregates, `adjusted=true&include_otc=false`.
- Always exclude the current New York calendar date. The first two available
  completed sessions within the preceding 14 calendar days provide the comparison.
- Display the actual trading date and collection time; these are end-of-day
  daily aggregates, not live prices or an intraday ranking. Do not label these as
  regular-session-only: the endpoint does not provide a session filter here.
- Change = `(latest close / previous trading session close - 1) * 100`.
  A ticker absent from the prior session has no percentage change and is excluded
  from gainers/losers, rather than comparing against its opening price.
- Estimated turnover = daily VWAP times volume. This is not the sum of raw trade
  notional values, nor closing price times volume. Missing VWAP excludes that
  ticker from turnover rankings. The UI labels this as an estimate.
- Include closing prices >= $1 and daily volume >= 10,000 shares; exclude OTC,
  invalid/nonfinite data, and duplicate symbols. These limits are visible in the UI.
- Gainers contain positive changes only; losers contain negative changes only.
- No fabricated names, logos, prices, zero-dollar placeholders, or demo rankings.
- Exclude known exchange test symbols ZVZZT, ZWZZT, ZXZZT and ZTEST. ZVZZT
  appeared in the real sample and must not be presented as an investable gainer.
  This explicit list is not a full daily security-master classification service.
  Nasdaq guidance: https://www.nasdaqtrader.com/MicroNews.aspx?id=ERA2016-5

Official API reference:
https://massive.com/docs/rest/stocks/aggregates/daily-market-summary

## Operation

`api/market-movers.js` is a Node.js standard fetch handler, also served by Vite in
development. Reuse the existing `VITE_POLYGON_KEY` configuration, or set a preferred
server-only `POLYGON_KEY`. The new endpoint never sends the key in responses or
client-side requests. This does not migrate older components that use the existing
Vite key. No new dependency or paid service is introduced.

Cache rankings for 30 minutes per server instance, coalesce concurrent requests,
and cache successful responses on Vercel for five minutes. Requests have a shared
20-second deadline and failures a 60-second cooldown. Weekends/holidays skip empty
successful responses; HTTP errors stop collection instead of comparing arbitrary
dates. Failures preserve cached rankings with their original timestamp and a
stale notice for at most seven days after collection. Without a cache, return 503.
The client refreshes every 30 minutes and supports manual retry; an existing
visible result is retained with a warning if a later request fails.

On 2026-09-11, the configured key returned HTTP 200 with 12,585 daily aggregate
records for September 10. The snapshot gainers endpoint returned HTTP 403, so
this implementation deliberately uses completed daily data. Live or delayed
intraday rankings require appropriate provider access and a separate change.
The September 9 sample contained 12,520 records. Both real samples were passed
through the collector and produced ten results in each ranking.

Validation: `node --test tests/market-movers.test.mjs` and `npm run build`.
