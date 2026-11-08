# News quality and source supplementation

Goal: reduce repeated macro previews in the first 12 home articles, distinguish
headline-indicated report/analysis/preview types, and group verified matching
policy-decision clues across Korean/English headlines. Preserve all original
URLs/times, source failure states and access via latest order. No article-body
scraping, new AI service, proxy or additional scheduled workflow.

Completion: regression examples cover topic concentration, stale vs fresh
reporting, corrections/changed figures/company/decision conflicts, related-link
access, PC/mobile order and article types. Compare old/new ranking on the same
production RSS snapshot. Full lint, Node, build and Chromium CI plus independent
review of the final tree. Merge/production are separate user-requested steps.

External scope: add Hankyung's documented finance feed as a separate source;
retain economy feed failures. Refresh validated BLS official and FRED snapshots
independently so success of one does not leave the other needlessly aging. A
failed provider never renews its file/timestamp; both failing must fail the
collector. Keep nine-family FRED limitation and official snapshot expiry.

## Ranking and article types

Keep the prior 8/7/6 headline signal weights, but split macro signals into
inflation/employment/growth/monetary buckets. Subtract 3 points per previously
selected article in the same bucket, and 1.5 per earlier macro article, per batch.
The existing 3-point publisher penalty remains. No hard topic quota removes an
article. After24h, age reduces score by one point per12h (in addition to the
existing freshness bonus decaying to zero at24h); eligibility still expires at72h.

Title-indicated analysis/opinion and preview/outlook receive a 1.5-point penalty.
Explicit company guidance increases/cuts/withdrawals remain report/general,
unless the title signals speculation or analyst expectations. UI labels say
`보도·일반`, `해설·의견`, `전망·예고`; these are automatic title heuristics and do
not certify the body, accuracy or importance. All remain reachable in latest.

## Matching decisions across headlines

Retain conservative ordered-token matching. Add a small bilingual grammar for
Fed/FOMC, ECB, BOJ and Bank of Korea decisions. Whole headlines must state the
same bank, hold/cut/hike and explicit percent target, within12h and the same New
York date. English hold requires `at`; cut/hike require `to`. Korean cut/hike
requires `%로`, separating change size from target. Corrections, updates,
forecasts and multi-clause reactions do not use this shortcut. No generic
cross-language semantic clustering or AI claim. Original links/time and
latest-order individual articles remain available.

## Observed comparison and source collection

Same production payload, fetched `2026-11-08T11:29:00.097Z`,151 eligible articles:
first12 macro articles9→4, represented publishers9→10, title-indicated
analysis/previews6→1. This demonstrates reduced concentration in one sample,
not a guarantee of editorial quality or important-event completeness.

Official Hankyung finance RSS returned200 and38 eligible parsed articles locally;
economy returned200 locally too. Existing production economy403 has not thereby
been repaired. New source retains separate status/backoff and publisher attribution.
https://www.hankyung.com/feed lists both official endpoints.

Actual official collection validated315 BLS events at2026-11-08T11:27:29.165Z and
33 FRED events at2026-11-08T11:27:38.660Z. Event title/date/time tuples equal the
previous snapshots; only retrieval times and ICS source-generated identities
changed. This is revalidation, not new dates or expanded FRED coverage. FRED
continues to cover exactly9 families; non-FRED releases still expire with the
original BLS snapshot. BLS/runner restrictions may persist after deployment.
The existing6-hour collector now attempts both paths independently. A failed
path never writes; if both fail, the workflow fails. All FRED pages must parse
before replacing its file. No mirror, proxy, scraping of publisher bodies,
authentication change, new schedule or Reuters substitute.

References: https://www.bls.gov/help/hlpiCAL.htm,
https://www.bls.gov/schedule/2026/,
https://fred.stlouisfed.org/releases/calendar.
