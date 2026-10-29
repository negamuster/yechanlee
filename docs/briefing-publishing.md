# Briefing publication

## Current operation: ChatGPT scheduled briefing (2026-10-12)

The owner authorized resuming researched Korean market briefings through ChatGPT scheduled tasks using the scheduler's **default model**. GPT-6.1 Sol cannot be pinned through the available automation tool; do not claim that it is selected. This supersedes earlier prohibitions on ChatGPT scheduling in the historical sections below. Paid AI APIs remain excluded. The Gemini research publication hold remains in place.

One ChatGPT task starts daily at **07:00 Asia/Seoul**, beginning October 13. This is the start time, not a guaranteed publication-completion time. Each run researches recent news and the last completed US session, writes three short homepage highlights (300–450 Korean characters overall) and a concise narrative (about 900–1,300 characters), then checks important claims against actually read sources. Verified market numbers and at most three upcoming events supplement the narrative. Same-model self-checking is not independent verification or human approval. Original source links and the existing automated publication/evidence/hash gates remain required.

## Editorial format (owner approved 2026-10-15)

Use [briefing-editorial.md](briefing-editorial.md) for direct issue discovery, market-flow paragraph order, one supported session-character sentence, earnings figure selection, concise provenance notes and calendar check items. It applies within the existing research/length limits and does not relax any publication gate. This explicit owner-requested October 15 revision retains its original cutoff and records the revision separately; normal scheduled runs still preserve existing same-date editions.

## Homepage presentation (owner approved 2026-10-14)

From October 15, new automated editions include a reviewed `homepage` object, generated from the same research as the summary and narrative. It contains a short factual `headline` with inline source IDs, up to four `stocks`, up to four `assets`, and up to three `events`. No extra AI request is needed. Omit unavailable rows rather than padding them. The October 14 edition was explicitly expanded at the owner's request using its existing checked claims, with its original cutoff retained and a dated revision note.

Schema (all source IDs refer to the edition's checked `sources`):

- `headline`: concise Korean theme, e.g. `은행 실적 반응 엇갈림…반도체 약세 지속[1][2]`. Keep the original `title`/session date for archive identity.
- `stocks`: `{ name, ticker, change, reason, basis, sourceIds }`. At most four important companies; use a signed change string, a short supported explanation and the trading/observation basis. Clearly separate intraday moves from closing changes. Do not infer causality merely from concurrent events.
- `assets`: `{ label, value, change, basis, sourceIds }`. Prefer 10-year yields, dollar, spot gold and WTI; distinguish Treasury par yields, intraday quotes, spot/futures, currency/units, contract month and comparison date. Preserve approximate source precision. If contract month is unknown, exclude price level and state that in `value`/`basis`. Changes retain their own units (percent, bp or dollars).
- `events`: `{ at, label, detail?, sourceIds }`. `at` is an ISO timestamp with explicit timezone, after the fixed cutoff and within 72 hours. Display absolute KST date/time and label the list as of the edition. Add `detail` only when supported; do not invent consensus estimates.

Homepage fields are part of the content hash and public projection. `scripts/briefing-homepage.mjs` checks limits, attribution and event timing; it is not a fact-checking engine. Source evidence must cover the homepage as well as the narrative. Missing `homepage` on new automated editions (October 15 onward) prevents publication. Earlier editions and manual rules fallback remain compatible. The scheduled job still commits only its new edition and rebuilt public payload.

On important economic-release days, include actual/consensus/prior values (each only if verified) and reported market reaction in the narrative using the existing focused source budget. No daily requirement to fill every field. The main display reuses this content; it does not introduce a second research or rewrite pass.

Usage is limited by one agent, a focused source set (target 5–8), one draft and one factual check, without subagents or repeated full rewrites. This is a scope limit, not a guaranteed token budget. Missing evidence is omitted; unresolved material errors, connection, approval, build or deployment failures hold publication and preserve the live edition. Existing same-date publications are never overwritten.

To avoid competing same-date editions and recurring Gemini trials, `.github/workflows/daily-digest.yml` is now **workflow_dispatch only**. Its schedules, data-health completion trigger and push-triggered Gemini live trial are removed. It retains a manually invoked non-AI rules fallback; invoking it first on a date will preserve that rules edition against later ChatGPT replacement. No secret or historical edition is removed. Independent data-health/BLS schedules remain separate.

The task retrieves current main over the GitHub connection each run; it does not depend on persistent scratch files. Only a new `content/briefings/YYYY-MM-DD.json` and the rebuilt `src/data/published-briefings.json` and `src/data/latest-briefing.json` may be committed during normal publication. Content is labeled `automated`, and Vercel success must be confirmed. Activation is not proof that the first future run succeeds.

`content/briefings/*.json` contains editorial drafts. This is a public GitHub repository: do not place confidential notes or credentials here. Drafts are excluded from the website bundle by `scripts/build-briefings.mjs`. The public payload is an explicit projection with review fields removed.

A build does not verify financial facts. Editors must read and verify each source, date, unit, trading session, market quote and interpretation before release. Reposted wire stories are not independent confirmations. Keep the original information cutoff when revising copy.

To publish after editorial review:

1. Finalize reader content and corrections; specify an actual publication time.
2. Record each checked source ID, reviewer and approval time.
3. Use `contentHash(item)` from `scripts/briefing-publication.mjs` for the exact reviewed content, then set status to `published`.
4. Run publication tests and build; inspect the output and deploy through the normal reviewed GitHub process.

Any content change invalidates the approval hash. Invalid published entries stop the build; drafts cannot be requested through a guessed date URL. Existing published entries remain unchanged when a new draft is added. Archive dates are permanent and are not updated to today's date.

## Historical AI-reviewed editions

The owner authorized scheduled AI-reviewed publication on 2026-10-06; the October 7 morning edition used that method. On 2026-10-07, the owner replaced it with the rules-only workflow below and stopped the previous ChatGPT schedule. Do not recreate that schedule or introduce paid AI API calls for daily publication.

Manual reviews remain supported. Existing `automated` editions must identify their reviewer honestly and pass the extra source-evidence gate. The gate checks structure and evidence records, not factual truth. No user-entered HTML is rendered.

## Rules-only publication (2026-10-07 migration)

The owner approved a non-AI digest workflow. `review.mode=rules` uses `validateRules` with input provenance and deterministic data checks, not `factualReviewPassed`. It does not claim human or AI editorial approval. Old `manual` and `automated` gates remain intact. See `docs/briefing-automation.md`. No historical edition should be changed to the new mode.

Daily scheduling is managed by `.github/workflows/daily-digest.yml`, using `0 22 * * *` (07:00 Asia/Seoul), with `17,37 22 * * *` recovery attempts (07:17 / 07:37 KST). Same-date editions are preserved. The first scheduled rules-only edition is expected on 2026-10-08. GitHub may delay execution, and collection, build, and deployment take additional time; 07:00 is not a guaranteed site publication time. Push-triggered runs only test collection and build without publishing. Scheduled or manually triggered runs generate a new edition, validate and build it, push the publication files, and check Vercel deployment status. Existing same-date editions are preserved.

The digest uses original RSS titles and links, official Treasury yields, and Fed/BLS/BEA schedules without AI analysis or translation. It is displayed as `규칙 기반 자동 정리 · AI 미사용`. See `docs/briefing-automation.md` for source-selection rules, safeguards, and failure handling.

## Gemini headline summaries (2026-10-08 update)

The owner now authorizes the free-tier Gemini API for headline summaries. This supersedes the rules-only restriction above; paid APIs and ChatGPT schedules remain excluded. See the Gemini extension in `docs/briefing-automation.md` for limits and billing caveat. `gemini` editions retain original headlines and official data, add Korean summaries based only on those headlines, and honestly display `Gemini 제목 요약 · 자동 대조`. They do not claim article-body verification or use the historical automated editorial gate. The publication gate reconstructs their reader content from the stored deterministic base and checked summaries. Any failure before publication falls back to a rules edition. Historical editions are unchanged.


## Body-grounded Gemini publication (2026-10-08 afternoon)

The owner requested article-body collection, summaries and evidence-based interpretation. The current `research` workflow and `gemini-research` mode supersede the headline-only stage for future dates. Reader sections distinguish reported facts, documented changes, conditional Gemini interpretation and next checks. A missing before/after comparison is explicitly marked unavailable. Unavailable/paywalled bodies cannot ground any claim. Treasury and official calendar blocks remain unchanged. Original bodies are not republished or stored in the public repository; provenance uses paragraph hashes and IDs. Automatic evidence comparison is not independent factual verification. See the current section of `docs/briefing-automation.md` for the exact limits, fallbacks and validation commands. Historical editions, including October 8, remain unchanged.


## Current source policy and reliability (2026-10-08 evening)

The current research stage summarizes up to three public-domain BEA release excerpts from the previous 14 days, requiring at least two, and labels their actual dates and reporting periods. Commercial news is original RSS titles/links only and is excluded from AI inputs pending reuse/transmission permission. See the current section of `briefing-automation.md`; its policy supersedes the initial commercial-body implementation described above. A rules fallback remains publishable, with its reason in private-to-reader review metadata and Actions diagnostics (the repository itself is public).

Transient 503/504/transport failures retry at most three times per logical request; other failures do not. Primary scheduling prepares at 06:53 KST and waits until 07:00 for collection, with the existing 07:17/07:37 recovery triggers. Existing editions are preserved. GitHub delays and generation/deployment time still prevent an exact 07:00 publication guarantee. Push-triggered trials remain non-publishing and fail visibly if research does not pass.


October 9: current research uses the same Flash-Lite model for generation, at most one rejected-claim-only correction, and a fresh evidence comparison. This is explicitly disclosed as same-model checking, not independent verification. See the current automation section for the maximum four logical/twelve physical calls, source scope, project-specific unverified quotas and data-health completion recovery trigger. Do not call recovery complete before the owner reads a passing non-publishing preview.
