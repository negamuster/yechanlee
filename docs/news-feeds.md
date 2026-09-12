# Homepage news

`/api/news` is a Vercel Node.js Web Standard handler. It collects publisher
RSS feeds and returns headline metadata, original links, publication times,
and optional feed-provided images. It never scrapes article pages or returns
article bodies. The current response version is `rss-node-v3`.

## Publishers

| Publisher | Coverage / connection | Latest verification in this development environment |
| --- | --- | --- |
| BBC Business | Business RSS | Live XML parsed in the first version; deployment verification is separate |
| WSJ | Markets and US business RSS | Markets XML parsed in the first version; US business remains unverified |
| CNBC | Finance RSS | Configured; this environment previously returned 403 |
| Bloomberg | Markets RSS | HTTP 200; 20 eligible articles parsed; this sample contains no image metadata |
| Financial Times | Markets RSS | Configured; HTTP 403 here, needs preview confirmation |
| Yahoo Finance | News RSS | Configured; HTTP 429 here, needs preview confirmation |
| Reuters | Optional provider-issued authenticated RSS URL | Not active without `REUTERS_RSS_URL`; not advertised as a working free feed |
| 매일경제 | Economy and stocks RSS | Existing integration; this environment previously blocked/timed out |
| 조선비즈 | General RSS filtered for business topics | Existing integration; live collection succeeded in the first version |
| 한국경제 | Economy RSS | Added; HTTP 403 here, needs preview confirmation |
| 연합뉴스 | Economy RSS | HTTP 200; 120 eligible articles, 109 with accepted image metadata |
| 연합인포맥스 | All articles RSS | HTTP 200; 50 eligible articles; feed dates without a timezone use Korea (+09:00) |

The new feed samples were retrieved on 2026-09-11. HTTP success and local
parsing do not prove that every feed and image loads in the deployed browser.
The user reported that the preceding Node version looked good in preview.
The preview is Vercel-login-protected, so the agent cannot independently
inspect its authenticated API responses. Inspect `sources` in `/api/news`
to distinguish `ok`, `empty`, `unavailable` and `not_configured`.

이데일리 was considered but its tested feed returned 502, so it was not
added to the active list. Google News RSS was also evaluated but deliberately
not integrated: its feed notice limits use to a personal, non-commercial feed
reader. It is not used as a workaround for this public site's Reuters feed.

## Reuters configuration

Reuters documents authenticated RSS delivery to Reuters Connect customers:
https://liaison.thomsonreuters.com/page/rss-feeds-tech-notes

Set `REUTERS_RSS_URL` in the existing Vercel project's appropriate environment
to a provider-issued HTTPS RSS URL that is authorized for the intended site
use, then redeploy. Never commit the URL if it includes a token. The current
adapter accepts URL-based authentication only. If the provider requires
Basic authentication or an OAuth flow, that authentication adapter needs to
be added after the provider's requirements are known.

The configured URL and redirects are restricted to approved Reuters /
Thomson Reuters hosts. Query credentials remain server-side and are never
included in responses, logs or frontend code. No value is configured by this
change. Missing configuration is reported as `not_configured` and does not
prevent other feeds from loading.

## Images and selection

- Extract images from `media:content`, `media:thumbnail`, Media RSS groups,
  image enclosures, or an `<img>` attribute supplied in a feed description.
  Never render the feed's HTML or fetch article pages to find more images.
- Accept HTTPS images only on the publisher's configured domains/CDNs.
  Preserve image URL signature and resize parameters, and show image credit
  when the feed supplies it. Reject obvious tracking/logo URLs and tiny images.
- All stories use equal-sized cards in two columns (one column on small screens),
  with a fixed 16:9 image frame and a three-line headline area. Full headline text
  remains in the document and the title tooltip. There is no oversized lead card.
- Images fill the frame with `object-fit: cover`; the first two load eagerly and
  remaining images load lazily. Small source images may be enlarged to fit.
  Missing, broken, or very small images use a neutral same-size frame labelled
  "이미지 없음". Reserve one line for image credit even when none is supplied.
  Not all publishers include images in RSS when the article page has a photograph.
- Show up to 12 stories, with at most 3 per publisher. Give each available
  publisher one slot before taking its next story. Interleave regions while
  choosing the combined view, then sort the selected stories by publication time.
- Region labels describe the publisher/feed group, not the country discussed.
  Headline language is preserved. There is no importance ranking or semantic
  clustering of related stories from different publishers.
- Filter promotional titles/categories, duplicate normalized exact titles,
  duplicate canonical URLs, missing/invalid dates, implausible future dates,
  and articles older than 72 hours. No fallback restores rejected articles.

Feed availability is not a blanket redistribution license. The site owner
should check the applicable publisher terms for their intended headline and
image display use before public rollout. Paid original articles still require
the original publisher's subscription. This change does not bypass paywalls.

## Resilience, cache and diagnostics

- Bound each complete feed request/body read to 10 seconds and 2 MiB. Use an
  AbortController plus a hard promise deadline without `AbortSignal.timeout`.
- Follow up to three HTTPS redirects within configured feed/publisher hosts.
  Requests identify the Anthracite application.
- A source failure does not discard working sources. No eligible articles
  across all sources returns 503 with `Cache-Control: no-store`.
- Unavailable sources include sanitized codes such as `http_403`, `timeout`,
  `request_failed`, `read_failed`, `parse_failed` or `redirect_not_allowed`.
  Response bodies, stack traces and credentials are not exposed.
- Server and session caches last 10 minutes; CDN cache lasts up to 5 minutes.
  Open pages refresh every 10 minutes. The refresh button uses current server
  data rather than bypassing upstream/CDN caches. `fetchedAt` is the original
  collection time. The expanded version uses a new browser cache key.
- Failed refreshes retain previously loaded eligible articles and show an error
  notice with the old collection time. Articles over 72 hours old disappear.

## Development and validation

`npm install` then `npm run dev` runs the same Node handler using the Vite
middleware. `npm run preview` serves static output only and does not emulate
Vercel Functions.

Run `node --test tests/news*.test.mjs` (Node 24 for native TypeScript imports in
selection tests), and `npm run build`. Eighteen tests cover feed parsing,
filters, image metadata, publisher selection, Korean timestamps, Reuters
configuration isolation, time limits, redirects, partial outages and caches.
The repository's existing Tailwind build warnings remain unchanged.

No browser interaction testing or production merge is performed. Check the
Vercel preview's images, region buttons and source statuses before merging.
