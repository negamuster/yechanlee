# Briefing publication

`content/briefings/*.json` contains editorial drafts. This is a public GitHub repository: do not place confidential notes or credentials here. Drafts are excluded from the website bundle by `scripts/build-briefings.mjs`. The public payload is an explicit projection with review fields removed.

A build does not verify financial facts. Editors must read and verify each source, date, unit, trading session, market quote and interpretation before release. Reposted wire stories are not independent confirmations. Keep the original information cutoff when revising copy.

To publish after editorial review:

1. Finalize reader content and corrections; specify an actual publication time.
2. Record each checked source ID, reviewer and approval time.
3. Use `contentHash(item)` from `scripts/briefing-publication.mjs` for the exact reviewed content, then set status to `published`.
4. Run publication tests and build; inspect the output and deploy through the normal reviewed GitHub process.

Any content change invalidates the approval hash. Invalid published entries stop the build; drafts cannot be requested through a guessed date URL. Existing published entries remain unchanged when a new draft is added. Archive dates are permanent and are not updated to today's date.

The owner authorized scheduled AI-reviewed publication on 2026-10-06. See `docs/briefing-automation.md` for the 07:00 Asia/Seoul task and evidence requirements. Manual reviews remain supported. Automated editions must identify their reviewer honestly and pass the extra source-evidence gate. No user-entered HTML is rendered. Scheduling is managed in ChatGPT, not by a repository cron. The gate checks structure and evidence records, not factual truth.

## Rules-only publication (2026-10-07 migration)

The owner approved a non-AI digest workflow. `review.mode=rules` uses `validateRules` with input provenance and deterministic data checks, not `factualReviewPassed`. It does not claim human or AI editorial approval. Old `manual` and `automated` gates remain intact. See `docs/briefing-automation.md`. No historical edition should be changed to the new mode.
