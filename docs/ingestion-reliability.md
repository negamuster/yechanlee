# News and calendar collection reliability

## Goal and acceptance criteria

Preserve usable, correctly attributed news and schedules during partial outages without treating blocked requests as successful collections. This change is complete when:

- A failed source waits before another request; repeated transient failures back off, and HTTP 429/503 Retry-After is respected within a documented bound.
- Concurrent calendar and snapshot requests share one in-flight operation. Failed snapshot lookups are also cached briefly instead of being repeated for every visitor.
- Every response rechecks the original article/snapshot retention deadline, including cache hits. CDN freshness plus stale-while-revalidate is bounded by the earliest article expiry; retained failed-source responses use no-store. Expired data cannot become fresh through a fallback or cache read.
- Source diagnostics distinguish last collection, last attempt, error and next retry. Operational checks warn on stale retained news as well as unavailable feeds.
- Regression tests cover failure, waiting, expiry and recovery; the existing full Node/build/desktop/mobile suites pass on the integrated revision.

## Scope and data rules

Changes are limited to collector retry/cache behavior, source status presentation, regression tests and existing monitoring. No new feed address, third-party proxy, paid provider, secret, cron, storage service or deployment is introduced. Reuters stays explicitly unconfigured without an authorized feed URL. Briefing collection remains live-only.

Keep the existing article metadata, publisher/host allowlists, deduplication and topic rules. News may retain a failed source's prior articles for at most six hours, and articles remain limited to 72 hours from publication. A verified empty feed clears prior articles. The bounds are checked again at response time.

Calendar data keeps its source collection time: direct BEA/Fed/earnings fallback expires after 24 hours; verified BLS/FRED snapshots expire after seven days and are stale after 48 hours. FRED continues covering only nine BLS release families, using its declared US Central timezone. No dates or values are inferred. Successful empty schedules remain distinct from failed or malformed requests.

Retries are demand-driven and per server instance, with no immediate retry loop. Preserve the 403 floor of 30 minutes, 404/410 floor of six hours, and 429 floor of 15 minutes. Other failures start at one minute and double up to 15 minutes. A valid Retry-After on 429/503 can extend the wait up to 24 hours; longer values are capped to avoid an indefinitely disabled source. A later success resets the failure count. Cache/snapshot timestamps never reset on a failed attempt.

## Current external limits

On October 23, 2026, a direct development-environment check returned Yahoo RSS HTTP 404, and HTTP 200 with valid content for Hankyung economy RSS and BLS ICS. Production/GitHub checks still reported Hankyung/BLS 403. These observations show environment-dependent availability, not a verified replacement endpoint or a repair of upstream access. Keep these failures visible. BLS documents the existing ICS at https://www.bls.gov/schedule/; do not guess alternate routes or scrape article bodies.

## Verification

Use deterministic fake-clock/transport regressions for Retry-After, negative caching, request coalescing, stale metadata, retention boundaries, malformed/oversized calendar bodies and recovery. Preserve the existing BLS/FRED date replacement and timezone tests. The existing browser suite plus source-status scenarios covers desktop/mobile presentation. An implementer-independent review must check the final integrated SHA and the failure/expiry rules before PR completion; record remaining environment and browser limits in the PR.
