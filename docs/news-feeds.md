# Homepage news

The homepage now requests `/api/news`, a Vercel Node.js function collecting
publisher-owned RSS feeds. No new API key is required. The existing Polygon
integration on other pages is unchanged.

## Sources and verification

| Publisher | Feed coverage | Verification in this development environment, 2026-09-11 |
| --- | --- | --- |
| BBC Business | Business | HTTP 200; 38 recent entries parsed from a downloaded live feed |
| WSJ | Markets, US business | Markets HTTP 200; 43 recent entries parsed. US business is configured but not verified. Node requests to WSJ timed out here. |
| 조선비즈 | General feed, filtered for business/finance topics | Live collection through the application collector returned 19 recent entries |
| CNBC | Finance | Configured; HTTP 403 from this environment |
| 매일경제 | Economy, stocks | Official RSS URLs configured; requests blocked or timed out here |

BBC and WSJ counts describe live XML downloaded using this environment's
system HTTP proxy and then parsed by `parseFeed`; they are not a claim that
the deployed Vercel function has been tested. Confirm source statuses in
`/api/news` after deploying a preview on the existing Vercel project. Do not
advertise every configured publisher as available until that check passes.

Reuters, Bloomberg, Financial Times and Yahoo Finance are **not integrated**
in this version. Add them only after verifying a suitable feed/provider and
the relevant display rights. Public RSS availability is not a blanket license
for redistribution. The owner should review the publishers' applicable terms
for their site use before public rollout, including headline display. No
article body, summary, photo, paid content, or publisher logo is republished.
Links open the original publisher; any subscription requirements still apply.

Official source references:

- https://www.mk.co.kr/rss/
- https://www.cnbc.com/rss-feeds/
- https://feeds.bbci.co.uk/news/business/rss.xml
- https://feeds.content.dowjones.io/public/rss/RSSMarketsMain
- https://biz.chosun.com/arc/outboundfeeds/rss/?outputType=xml

## Behavior

- 전체 / 해외 / 국내 filters refer to the publisher's feed group, not the country
  discussed in each article. Original headline language is preserved.
- Most recent 72 hours only; reject missing/invalid dates and implausible future dates.
- Suppress promotional headline/category patterns and deduplicate canonical URLs
  and normalized exact titles. Similar reporting about the same event can remain;
  there is no semantic clustering or importance ranking.
- The display contains up to 12 stories, with at most 3 per publisher. The
  combined view reserves room for both regions when available, then sorts by
  publication time. The lead story is the newest selected story.
- Headlines are rendered as React text, never HTML. Only HTTP(S) links to each
  configured publisher's domains are accepted. XML declarations of custom
  entities are rejected. Feed reads are bounded to 2 MiB and 10 seconds.
- A failed source never reinstates filtered articles. Other sources continue;
  total failure returns 503 with no-store. Source statuses distinguish a failed
  feed from a working feed without eligible recent articles.
- Server cache and browser session cache: 10 minutes. CDN cache: up to 5
  minutes. Open pages refresh every 10 minutes. A refresh button requests the
  current server result; it does not bypass server/CDN caching. `fetchedAt`
  remains the original collection time, not the time the page was opened.
- Failed refreshes retain previously loaded articles, show the old collection
  time and an error notice, and stop showing articles older than 72 hours.

## Local development and validation

`npm install` then `npm run dev` uses the Vite middleware to run the same
`api/news.js` handler locally. `npm run preview` only serves static build
output and does not emulate Vercel Functions.

Run `node --test tests/news.test.mjs` for parser, URL validation, filtering,
partial outage, size limits, API cache and concurrent request checks. Run
`npm run build` for the TypeScript and production bundle check.

The repository's existing Tailwind `@theme` / `@tailwind` build warnings
remain; this change uses ordinary CSS and does not change Tailwind setup.
Browser interaction testing and Vercel deployment are not performed by this
change. Test the preview's region buttons, original links, and `/api/news`
source statuses before merging to the production branch.

## Follow-up: all sources unavailable in preview

The user supplied a deployed response in which all seven sources were
`unavailable`. That confirms the route executed but does not identify the
underlying exception; the first version discarded the error details.

The follow-up uses Vercel's documented Node.js `export default { fetch }`
handler rather than Edge. The collection path no longer depends on
`AbortSignal.timeout`: an AbortController plus a hard promise deadline covers
both request and response-body reads, even if an upstream ignores abort.
Publisher redirects are followed only within the configured feed/publisher
hosts (HTTPS, up to three hops). Requests identify the Anthracite application.

Responses include `version: "rss-node-v2"`. Unavailable sources include a
sanitized `error` such as `http_403`, `timeout`, `request_failed`,
`read_failed`, `parse_failed` or `redirect_not_allowed`. No response bodies,
stack traces, or credentials are exposed. These codes let the owner inspect
failures through the authenticated preview's `/api/news` route.

Eleven automated checks pass, including the absence of the static timeout
API, redirect handling, hard deadlines, and failure diagnostics. The hosted
runtime cause and end-to-end recovery still require confirmation in the
login-protected Vercel preview. A successful deployment status alone does
not prove the feeds load.
