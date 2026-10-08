# Briefing publication

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
