# Daily automated briefing

## Authorization and runtime

The owner authorized automatic publication in this conversation on 2026-10-06, replacing the initial requirement for daily human approval. Publish only after the evidence review below. Never attribute an automated review to the owner or invent human approval.

A ChatGPT scheduled task starts every day at 07:00 Asia/Seoul. Research, checking and Vercel deployment finish afterwards; 07:00 is not a guaranteed live-publication deadline. This is not a Vercel cron or GitHub Actions generator and requires no newly configured model API key. Connected GitHub access, web research, account usage and automatic action review must remain available. If unavailable, stop and report the reason. Do not bypass platform approval controls.

Do not depend on persistent scratch files. Read current main, this document, `scripts/briefing-publication.mjs`, `scripts/briefing-auto-review.mjs` and current content from GitHub on every run. Preserve unrelated commits and use an expected-SHA branch update. Do not create a second scheduler.

## Edition and time

Use the actual run's KST date for the edition ID. At run start fix cutoffAt; report the previous 24 hours and the most recent completed US regular session. Confirm trading holidays and early closes from exchange sources; do not calculate the last session by subtracting a calendar day. Distinguish session news from after-close news and date old background explicitly. No information published after cutoffAt belongs in this edition. Use actual approval and publication timestamps, never a backdated 07:00 publication time.

Weekends/holidays may have a shorter new-news edition with the last session date retained. Do not reissue an unchanged report with a new date. If the current date is already published, do not overwrite it. Read actual published history before making comparisons.

## Editorial process

1. Collect candidate events from Reuters, Bloomberg, WSJ, FT; complement with CNBC, Yahoo, reliable Korean reporting. Prefer central banks, BLS/BEA, ISM releases, Treasury, official exchange data and company IR for numerical facts. Keep wire republication relationships explicit. Do not infer article details from snippets or inaccessible pages.
2. Rank by market impact, novelty and changed expectations. Deduplicate events. Target 6–9 stories (fewer when evidence is scarce) and 1–2 external analyses only when actually read. Do not add AI/semiconductor content just to fill a quota; include relevant AI infrastructure developments when material.
3. Read the actual source text. Check reported values, units, period, publication/event times and quote conventions. Estimates vs actuals, GAAP vs adjusted, spot vs futures and daily vs weekly comparisons must stay separate. Employment actuals need BLS; consensus needs its survey source. A current FedWatch snapshot cannot verify yesterday's probability. Treasury par yields are not identical to a quoted benchmark Treasury yield. Never use a missing price as zero.
4. Compose Korean main summary (3–4 concise paragraphs) and detailed body (roughly 3,000–4,500 Korean characters, shorter when warranted). Structure: 30-second context, macro/company/analysis stories, one main change examined through cause/repetition/transmission/persistence/perspective, then market state/risks and at most three official 24–72-hour events in KST chronological order. Distinguish source opinion, company outlook and Anthracite interpretation. Avoid triple repetition and generic disclaimers after every item. Titles must be supported by the body.
5. Run a separate factual review pass against the retrieved sources, not just a re-read of the prose. Recheck all main-summary claims, calculations and links, date alignment, quote precision, source labels and numeric comparisons. Record each retained source and its supported claims in review.sourceChecks. A second AI pass is not independent human verification. Delete unsupported details or replace their sources; do not patch gaps by guessing. If a material unresolved issue remains, do not publish.

## Public payload and evidence

Create `content/briefings/YYYY-MM-DD.json` with existing fields: id, status, title, sessionDate, cutoffAt, publishedAt, summary, blocks, sources, dataNote, corrections, review. Body kinds: heading, subheading, metadata, paragraph. Use metadata blocks for publisher/time/type/session tags. Strip Markdown heading markers from summary strings. Paragraphs cite numeric IDs such as [1]. Source objects: id, label, url, optional accessNote and links[{label,url}]. Put original source first and actually read republication as a secondary link where necessary. Do not make up URLs. Explain genuine limitations briefly in dataNote; no private working notes.

For an automated edition review contains:

- mode: `automated`
- approvedBy: `Anthracite automated editorial review`
- approvedAt: actual completion time
- factualReviewPassed: true ONLY after the factual pass
- unresolvedIssues: [] ONLY if no material unresolved issues remain
- checkedSources: every retained source ID
- sourceChecks: one record per source `{sourceId, verifiedUrl, checkedAt, publishedAt, basis, claimSummary}`. verifiedUrl must match that source's primary or secondary link. basis is primary/reported/analysis. publishedAt is the actual source publication time, or null for an undated official data page; never use null to hide a known post-cutoff publication. checkedAt is actual retrieval time. claimSummary is a concise original description of verified claims with units/periods. Do not copy full copyrighted pages into the public repository.
- contentHash: calculate with contentHash(item) AFTER content, timestamps and source records are finalized. Review fields are excluded from that hash as in the existing publisher.

The website labels automated editions `AI 작성·자동 검토`. The deterministic gate checks evidence completeness, dates and hash; it does NOT prove financial claims. Remain honest about reported-only figures. Do not scrape Yahoo's undocumented chart endpoint as the default daily source until reuse terms have been assessed; use accessible official sources or clearly attributed verified news reports.

## Publish transaction

Work in an isolated current-main snapshot. Do not alter layout, publication guards, secrets, dependencies or old articles during a scheduled run. Do not publish the old October 6 draft simply because it exists.

Only after factual checks, set status to published, compute the hash, run `node --test tests/briefing-publication.test.mjs tests/briefing-auto-review.test.mjs` and `npm run build`. Verify the generated payload includes exactly the intended new edition and all previous published entries. If tools, install or build fail, stop without changing main. Successful local checks are not successful deployment.

Commit the new edition and matching `src/data/published-briefings.json` using GitHub. If main moved, refresh and regenerate against latest main; never force-push or overwrite other content. Monitor the commit's Vercel status. On failure preserve existing live content, report the deployment failure, and do not claim publication. Do not delete a failed commit automatically. A same-date rerun should inspect and resume deployment status rather than create a duplicate edition.

Respond in this conversation with the edition URL, information cutoff, actual outcome and any meaningful limitation. For a blocked run report a short reason and say the previous edition remains; do not send email or Slack messages. Never change the old edition's date to imply a refresh.
