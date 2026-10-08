# Daily briefing: source-grounded Gemini with deterministic fallback

**Current operation is described in the final reliability/source-policy section below. Earlier sections are migration history.**

## Historical rules-only operation (owner approved 2026-10-07)

The owner requested removal of ChatGPT/API usage from daily publication. Starting with the next new KST date, `.github/workflows/daily-digest.yml` runs ordinary Node.js code at 22:00 UTC (07:00 Asia/Seoul), with recovery attempts at 22:17 and 22:37 UTC (07:17 / 07:37 KST). Existing same-date editions are preserved; recovery attempts do not collect new inputs or replace them. GitHub can delay schedules; this is not an exact publication-time guarantee. No model, translation, paid news API, or new secret is used. Standard public-repository GitHub-hosted runners are used. Existing Vercel hosting limits still apply.

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

## 2026-10-08 recovery

At approximately 07:56 KST, the workflow was active on main but no October 8 scheduled run was present in the Actions run history. The cause of the absent run is not exposed; delay versus dropped scheduling cannot be distinguished. GitHub documents that scheduled events may be delayed or dropped under load, especially at the start of the hour: https://docs.github.com/en/actions/how-tos/troubleshoot-workflows.

The October 8 edition was generated as an on-demand recovery using the unchanged deterministic generator and live inputs, with its actual collection/publication timestamps. It is not evidence that the first scheduled run succeeded. Recovery cron entries reduce dependence on one trigger, but share GitHub's scheduler and do not guarantee an exact publication time. No AI calls or ChatGPT automation were added.

## 2026-10-08 Gemini free-tier extension (supersedes rules-only operation)

The owner created a Free Tier Gemini project and registered `GEMINI_API_KEY` in GitHub Actions. `BRIEFING_AI=gemini` enables an optional headline-summary stage with pinned `gemini-3.8-flash` (official free-tier pricing checked 2026-10-08). No billing setup, paid model fallback, Search grounding or ChatGPT automation is used. API keys do not encode billing status: keep this Google project on Free Tier; enabling billing outside this repository could incur charges. The code cannot verify billing status from the key.

The stage sends only selected public RSS titles and source IDs, at most 16,000 characters. One bounded request creates Korean headline summaries and a second request checks faithfulness against those same titles. Each request times out after 60 seconds and caps output at 4,096 tokens; no retries. Original titles, source URLs, official yield numbers and calendar timestamps remain untouched. News body reading, broad market analysis and verified investment conclusions are NOT provided. This is a first step towards richer briefings, not a restoration of full researched AI analysis.

`review.mode=gemini` and the reader disclosure distinguish AI headline summaries from deterministic and historical AI editorial editions. A deterministic base record, summaries and comparison result are retained for reproducibility. Publication validates evidence, source IDs, duplicate/missing outputs, newly introduced digit tokens, output bounds and unchanged official-data blocks. These checks and the model comparison cannot guarantee factual accuracy or detect every mistranslation.

Missing key, HTTP failure (including quota exhaustion), malformed response, numeric/structural rejection or failed model comparison keeps the unmodified rules digest. Same-date editions are still preserved before any network/model call. Pushes make a non-publishing live check with `--require-ai`: a fallback is treated as a failed integration check, not a Gemini success. Push previews print only public summaries and never keys/API error bodies. Scheduled/manual runs allow rules fallback.

Validation: `node --test tests/briefing-*.test.mjs`; `npm run build`. A local dry run without the secret cannot verify real Gemini access. Successful GitHub live checks are required to claim API verification. Existing October 8 publication is preserved; new-date editions use the optional stage.

Official references: https://ai.google.dev/gemini-api/docs/pricing and https://ai.google.dev/api/generate-content.


## Historical: initial body-grounded briefing (owner approved 2026-10-08 afternoon)

`BRIEFING_AI=research` replaces headline-only summarization for new dates. Research pins `gemini-3.7-flash`, whose standard input/output have a Free Tier on the official pricing page checked October 8. The initial 3.8 Flash research trials repeatedly returned HTTP 503; historical headline-mode records retain their original 3.8 model. There is no automatic paid or cross-model fallback. Each run selects up to eight recent RSS items, excludes obvious stock-signal promotions, and fetches the public HTML article body with two concurrent requests. BBC, CNBC, 매일경제 and 한국경제 have explicit host/DOM adapters. Each redirect is checked against the HTTPS host allowlist; no login, paywall bypass, third-party extraction service or paid search is used. Each page has a 15-second request deadline, 2 MB response cap, canonical-path check and publication/update-time checks. Unknown timestamps, post-cutoff revisions, paywall flags, video pages and insufficient bodies are excluded. Only the main article paragraphs are extracted, at most 9,000 characters per article; excerpt scope is disclosed. Parser changes can reduce coverage rather than silently substituting navigation text or titles.

At least two article bodies are required. Official Treasury and calendar records become separately identified model evidence while their published number/date blocks stay byte-for-byte unchanged. One model call produces 2–6 issues with reported facts, documented change (or explicitly unavailable), conditional interpretation and next verification questions. Each claim cites paragraph IDs. A second call checks all claims, attribution, units, comparisons and inferences against those paragraphs. This is evidence consistency checking, not independent confirmation of publisher claims. The current workflow does not fetch a complete US stock closing dataset or guarantee Bloomberg/Reuters/WSJ/FT coverage.

Per run: at most 85,000 input JSON characters, two Gemini calls, 8,192/4,096 output-token caps and a 60-second timeout per call. There are no automatic model retries or paid fallbacks. A Free Tier project must remain unbilled; API keys cannot prove the current billing tier. Error, quota exhaustion, inadequate bodies or rejected evidence produce the unchanged non-AI digest. An existing same-date edition returns before collection or model use. Recovery schedules remain 07:17/07:37 KST after the primary 07:00 trigger.

`review.mode=gemini-research` is distinct from historical headline and AI editorial modes. Public labels explicitly describe body-based AI summaries/inferences. Evidence metadata stores URLs, retrieval/publication/modification times, scope, document/paragraph hashes and numeric tokens. Full article bodies are used in memory only and are NOT committed or included in the public payload. Published output is paraphrased; source links allow readers to inspect originals. Unavailable sources remain labeled as links only, excluded from analysis. The build reconstructs published content and validates references, numeric tokens, coverage and unchanged official blocks. These checks cannot prove semantic truth or detect every wrong inference.

`--dry-run --require-research` is the push-triggered live integration gate: fallback is a failure of the research trial and never changes published content. `DIGEST_PREVIEW_PATH` can hold the generated preview outside the repository. Scheduled/manual publication permits fallback. Tests: `node --test tests/briefing-*.test.mjs`; build: `npm run build`.


## Current: reliability and source policy (2026-10-08 evening)

The unpaid Gemini terms allow Google to use submitted content to improve products and machine-learning technologies. Public availability and robots permission alone do not grant reuse rights. Commercial publisher body transmission is therefore disabled pending permission review, including BBC, CNBC, 매일경제 and 한국경제. News remains original RSS titles/links on the site and is not sent to the research model. This narrows AI coverage to official economic releases; it does not restore broad daily market/news analysis.

The collector now uses the BEA **current-releases HTML index**, at most three releases published within the previous 14 days, and at least two successfully collected bodies. BEA states that its information is public domain unless otherwise marked. Only release text is collected, excluding images/tables/third-party copyright-marked material. The release page's embargo date must match the index timestamp. HTTPS host/path and canonical identity are checked; redirects are refused. The collector checks robots.txt before the index and releases and fails closed on unavailable/disallowed robots. The apps.bea.gov RSS path was found robots-disallowed and is not used. Each request has a 20-second timeout and 2 MB streaming cap; robots is capped at 512 KB. Each body excerpt is capped at 9,000 characters, and original text is not persisted. Official excerpts are retrieved snapshots, not an archive proof that no later revision occurred.

The reader sees “recent 14-day BEA releases”, release dates, reporting periods, source links and retrieval timestamps. Older releases are context, never relabeled as today's news. Up to eight fresh commercial headlines remain in a separate original-title/link section. Official rates and calendars remain deterministic. Paragraph IDs, hashes and number-token checks plus a separate Gemini comparison gate remain required. Fewer than two recent official bodies, or any model/validation failure, retains rules publication. This deliberately makes official-release gaps visible instead of feeding uncleared commercial bodies to a free model.

Each logical Gemini generation/comparison call now has **at most three attempts**, a 45-second per-attempt timeout, a 150-second overall budget, and exponential 2/4-second backoff with up to 499 ms jitter. Only HTTP 503/504 and transport/timeouts retry. Quota 429, authentication, malformed output, numeric errors and rejected comparison do not retry. At most six physical model requests per run, no automatic cross-model or paid fallback. Keep the API project unbilled; code cannot verify billing configuration from a key.

`review.execution` stores the actual mode, model, stage, sanitized fallback reason, body coverage, source failures and per-stage request attempts. A separate `BRIEFING_REPORT_PATH` JSON is written before the strict dry-run gate; the workflow publishes it to its job summary even when Gemini fails. It contains no keys, raw error responses or article text and is excluded from the reader payload. Failures before optional AI processing may have no report; Actions reports that explicitly. An existing edition is still preserved, including a rules fallback: recovery crons are not silent rewriting jobs.

Primary cron is `53 21 * * *` (**06:53 KST preparation**). After setup/tests, a bounded wait prevents collection before 07:00 KST. Late starts proceed immediately. Recovery crons remain `17,37 22 * * *` (07:17/07:37 KST). Workflow timeout is 25 minutes, including preparation, bounded model calls and deployment observation. GitHub may delay/drop runs; this remains a target around 07:00, not an exact publication guarantee. No ChatGPT scheduling was added.

The unused Yahoo proxy is removed. The Claude route stays a tested HTTP 410 tombstone with no key access/provider calls; it is not a paid AI endpoint. Polygon key rotation and Vercel firewall account settings cannot be verified from repository content and were not changed.

Validation: `node --test tests/*.test.mjs`; `npm run build`; non-publishing live `--dry-run --require-research` in GitHub Actions. Local source collection on October 8 succeeded for three BEA releases (October 6 trade; September 30 GDP and personal income). A successful collector or mocked unit test does not establish real Gemini output quality; inspect the live run separately. The October 8 published article remains unchanged.

References checked October 8: https://ai.google.dev/gemini-api/terms ; https://www.bea.gov/help/faq/145 ; https://www.bea.gov/robots.txt ; https://apps.bea.gov/robots.txt ; https://docs.github.com/en/actions/how-tos/troubleshoot-workflows .
