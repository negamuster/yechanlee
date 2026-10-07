# Site audit fixes — 2026-10-07

## Correctness and freshness

- Stock daily change now compares two consecutive available, split-adjusted daily closes. Open is not used as the change baseline; Prev Close displays the prior close. Missing comparisons are unavailable, not zero.
- Show the US trading date, comparison date, collection timestamp in KST, source and non-realtime basis. A single snapshot supplies the quote and chart.
- Cache is fresh for five minutes; manual refresh and visible-tab refresh are available. Failed refreshes retain explicitly marked same-symbol data for at most 24 hours. Optional news/financial/related failures are visible and retried. Aborted or superseded requests cannot replace another ticker's result.
- Daily bars exclude the current New York day until 21:00 ET. This is a conservative application cutoff, not a provider publication guarantee. Provider availability can delay the displayed date.
- 52-week extrema use daily highs/lows. Financial reporting dates are shown. ROE uses ending equity, and total liabilities/equity is labeled accurately. P/E uses the latest annual diluted EPS, not TTM. Nonpositive denominators yield unavailable ratios.
- Market Movers can use the current NY day after 21:00 ET. Same-day coverage must contain at least 1,000 valid distinct symbols and 90% of the preceding available day's coverage. Otherwise it falls back to the preceding two sessions with a visible notice. Coverage is a safeguard, not proof of provider finalization.

## Presentation and operating limits

- RSS title entities inside CDATA or double escaping normalize to plain text before classification/deduplication. Browser news cache version advanced.
- News source counts exclude unconfigured feeds. HTTP 404 is shown separately from temporary collection failures.
- Stock detail switches to a single column below 700px, with wrapping and usable refresh/period controls.
- Legacy paid AI analysis UI was removed. `/api/claude-proxy` returns 410 and never reads a key or calls an AI provider. No paid AI or ChatGPT scheduling was introduced.
- BLS official snapshot was successfully revalidated: 313 releases, checked 2026-10-07T03:52:38.692Z. Seven-day expiry remains in place. FRED fallback scope is visible outside the collapsed help section.
- During direct collection checks, Hankyung and BLS returned HTTP 200. Earlier production/Actions 403 failures can still recur across environments. Yahoo's configured feed and tested topstories candidate both returned 404; no unverified replacement was installed. Reuters remains unconfigured.

## Validation

- `node --test tests/*.test.mjs`: 126 passed, including price baseline/extrema, invalid bars, DST cutoff, cache expiry, partial failure, cancelled requests, title decoding, same-day ranking coverage and no-spend API tests.
- `npm run build`: passed. Existing Tailwind unknown-at-rule warnings remain; this change does not alter the site's global styling pipeline.
- CI now runs the full test suite and build on source changes and pull requests.
- Mobile layout changes are code-reviewed; a real mobile viewport visual pass is still outstanding.
- The first scheduled non-AI briefing remains October 8 at 07:00 KST. Its actual scheduled execution cannot be verified in advance. Existing editions and the daily workflow schedule were not changed.
