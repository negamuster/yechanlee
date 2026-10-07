# Daily briefing: deterministic, no AI

## Current operation (owner approved 2026-10-07)

The owner requested removal of ChatGPT/API usage from daily publication. Starting with the next new KST date, `.github/workflows/daily-digest.yml` runs ordinary Node.js code at 22:00 UTC (07:00 Asia/Seoul). GitHub can delay schedules; this is not an exact publication-time guarantee. No model, translation, paid news API, or new secret is used. Standard public-repository GitHub-hosted runners are used. Existing Vercel hosting limits still apply.

The workflow has a manual trigger. Pushes affecting the generator run collection in dry-run mode and build without publishing. The previous ChatGPT schedule must be paused after successful migration checks. Do not create another ChatGPT automation.

## Reader contract

- `review.mode=rules`, displayed as `규칙 기반 자동 정리 · AI 미사용`.
- Reuse publisher RSS headline URLs and original titles, not article bodies, images, or invented summaries. Prefer Korean titles; English titles are not translated.
- Select at most two per publisher, eight overall, with exact URL/title deduplication and a strict prior-24-hour window. Previously included rules-edition links are excluded. This is topic/freshness selection, not a claim to identify all major market events.
- Use Treasury daily par yields for 2/10/30 years with explicit observation dates and prior-observation differences. Do not substitute index estimates or Yahoo chart calls. Rows are used only after 18:00 New York on their date, a conservative availability rule; old/missing/invalid data is omitted. These dates are NOT equity session dates.
- Fetch Fed/BLS/BEA schedules directly and show up to three timed events in the next 72 hours. IANA timezone rules handle DST. Missing feeds and no eligible timed events are not assertions that no events exist.
- No causal market commentary, investment recommendation, AI factual review or human approval is claimed. Existing AI/manual editions retain their labels and content.

## Publication safeguards

`scripts/generate-daily-digest.mjs` fixes an actual cutoff, refuses an existing same-date file, requires at least three fresh headlines from two publishers, records feed/data checks, and writes one new edition exclusively. Rules checks are a separate gate, not a bypass of the previous AI editorial-review gate. `contentHash` still protects reviewed payload integrity.

Workflow: install locked dependencies → tests → collect/generate → build public payload → commit only content/briefings and src/data/published-briefings.json → normal push → observe Vercel status. A competing main update fails the push instead of force-pushing; rerun from latest main. Collection/build failures keep old content. A deployment failure is reported as a failed workflow; no automatic rollback or success claim. GitHub may disable schedules after 60 days of repository inactivity.

## Validation

`node --test tests/briefing-publication.test.mjs tests/briefing-auto-review.test.mjs tests/briefing-rules.test.mjs`

`node scripts/generate-daily-digest.mjs --dry-run`

`npm run build`

Set `DIGEST_PREVIEW_PATH` to a scratch path to inspect a non-published preview. Never commit previews as a substitute for a real scheduled edition. No unchanged previous article is relabeled with a new date.

## History

2026-10-06: owner authorized AI-authored, AI-reviewed automatic publication without daily human approval. The October 7 morning edition used that method. On October 7 the owner requested this non-AI replacement to eliminate recurring model usage/API cost.
