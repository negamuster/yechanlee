# News stability and loading follow-up — 2026-10-07

## Scope

The owner confirmed mobile functionality is satisfactory. Mobile density and visual redesign are deferred. No paid AI, ChatGPT schedule, video autoplay preference, or briefing schedule changes.

## News

- Keep the publisher's configured RSS URLs. Hankyung's official directory still lists `/feed/economy`; no verified broad-market Yahoo replacement was found. Do not claim either external restriction is fixed.
- Failed feeds wait before another request: 404 for six hours, 403 for 30 minutes, 429 for 15 minutes, other failures for one minute. These are earliest retry times; the normal collection interval still applies. Cold instances reset the in-memory state.
- Last successful articles may survive a failed feed refresh for at most six hours and remain subject to the 72-hour publication window. Label these as previous collections and preserve the actual last success and last attempted check times. Successful empty feeds replace old articles.
- Response-cache hits and browser filtering also enforce fallback expiration. Responses containing fallback articles bypass CDN caching. Normal responses can use five minutes of CDN caching plus five minutes of background revalidation.
- `collectNews` remains stateless by default: the daily briefing generator does not consume this fallback cache. No new scheduled collection job or external proxy was introduced.

## Loading

- News images use native lazy loading; the first two images are no longer forced to load while outside the viewport.
- Stock search reuses valid results immediately for 15 minutes, including case changes and revisits. Fresh queries retain the 350ms debounce, avoiding requests for each keystroke.
- Closing search or selecting a result cancels work. In-flight searches time out after ten seconds with an actionable error. Aborted/malformed results do not poison the cache. Lowercase tickers can be submitted directly.
- Runtime HTTP measurements showed ~10 seconds even for static HTML, so they cannot isolate browser rendering or origin latency. No overall speed percentage is claimed. Initial cold news collection can still wait up to the existing ten-second per-feed deadline.

## Verification

Full automated suite and production build, including retry backoff, expiry, recovery, empty feeds, live-only briefing behavior, search cache expiry and cancelled requests. Deployment and UI checks are performed against the corresponding main commit.
