# Briefing editorial format

Owner-approved on 2026-10-15. Apply this format to future researched ChatGPT editions alongside `briefing-publishing.md`. Preserve the existing publication gates, source evidence, original cutoff and review disclosures.

- **Research:** directly discover important company/industry issues in the preceding 24 hours and last completed US session. Select two to four material issues when available. Read accessible reporting and relevant company/official originals; distinguish the event from a journalist's explanation of its market effect. Use one agent, a focused set of roughly five to eight core sources, one draft and one factual comparison. The homepage reuses that research.
- **Narrative:** aim for 900–1,300 Korean characters, shorter when warranted. Order connected paragraphs as market overview and session character, main economic/policy catalysts and their reported reaction, specific company/industry reactions, then bonds/currencies/commodities. Put an immediate yield reaction beside the triggering release when useful; put dated quote levels in the market-data section. Group related topics rather than switching from yields to stocks or from oil to the Beige Book within one paragraph.
- **Session character:** add one concise supported sentence to the overview. Use index differences and, when actually available, sector returns or advancing/declining-stock counts to describe concentration, breadth, rotation or risk sentiment. Do not infer capital flows, defensive rotation or a market-wide selloff solely from differing index returns. Do not add a generic unsupported sentence to fill this slot.
- **Company issues and earnings:** use one or two sentences for each selected stock's concrete event and the concern or expectation reported by the source. Separate company-specific issues from a common industry/macro factor. For earnings, prioritize the surprise relative to comparable expectations, the stock reaction and a material one-off item. Keep only figures needed to explain that reaction; do not list both net income and multiple EPS variants automatically. Align GAAP/adjusted, reporting period and units; omit unavailable estimates. Do not invent a distinct catalyst to avoid repetition.
- **Reader copy and provenance:** remove drafting/checking-process commentary from the narrative and quote rows. Put comparison methods, archive/rounding notes and source-update limitations in the relevant `sources[].accessNote`, with broader methods on `/briefings/methodology`. Keep `dataNote` short and honest about same-model self-comparison. Retain limitations that change the meaning of a value beside that value: trading date, close/intraday/after-hours, observation and comparison dates, Treasury par-yield definition, spot/futures, units and contract month. A global note is not a substitute for those local bases.
- **Calendar:** after each confirmed absolute KST time and label, add a short source-supported metric or question in the article and the existing `homepage.events[].detail`. Specify what to check (for example monthly/annual movement or a documented component); do not predict the release, fabricate consensus or prescribe a stock-market response. Keep at most three events and the existing cutoff/72-hour window. Omit unsupported detail rather than padding it.
- **Homepage and evidence:** keep three short highlights, the concise headline, at most four stocks/assets and three events. Keep them consistent with the narrative. Cite all new material claims and calendar details, extend `sourceChecks` after actually reading them, recompute `contentHash`, and run existing publication/homepage checks and the build. Schema and validation are unchanged.

Normal scheduled runs preserve an existing same-date edition. An explicitly owner-requested editorial revision must retain its original information cutoff, use only information belonging before that cutoff, record its actual review/revision time and add a correction entry. Retain necessary quote bases and do not relabel an old session as a new one.

## Major company and leadership issues (owner approved 2026-11-09)

Before drafting, run a focused material-event discovery pass covering leadership,
board actions, security/information incidents, succession/resignations, regulatory
investigations/litigation, and major products/customer/contracts as well as earnings.
Check the relevant company newsroom/IR or regulator original for discovered
material candidates; do not rely solely on closing recaps or the homepage RSS pool.
Issuer statements may be evidence for that issuer's position even when promotional
RSS filters would exclude ordinary press-release marketing from the home feed.
This is one bounded pass within the existing source budget, not an exhaustive scan
of every company or a claim of complete coverage.

Use an existing heading `주요 기업·경영진 이슈` when warranted. Prioritize events
with supported governance, security, regulatory, financial or operational relevance.
For each, distinguish confirmed event, company/board response, conditional investor
relevance, observed price reaction if available, and the next fact to verify. Omit
unavailable details and price rows; do not fabricate a return to fit homepage.stocks.
Material official announcements may qualify without an observed price move.
Personal allegations/details alone are not a market catalyst; retain attribution,
denials, investigation status and uncertainty. Do not infer guilt, secret leakage,
resignation, regulatory action, customer disruption or price causality.

An important event may enter the three summary highlights and homepage headline.
The detailed section and homepage must use the same checked source evidence.
`Anthracite 관점` is explicitly AI-authored conditional analysis; never present it
as the owner's own view unless the owner provided the actual view. Do not imitate
another commentator's wording or add investment advice.

Preserve the morning information cutoff. Later prices or developments must not
be inserted into its original facts or sourceChecks; the existing cutoff gate
still applies. A separately authorized later update must state its own information
basis and retain revision history; this instruction does not add intraday polling,
a second schedule or an automatic same-date overwrite. An owner-requested morning
omission correction uses pre-cutoff sources, the actual revision time, correction
history and recomputed contentHash. Ordinary scheduled runs keep same-date content.

November9 case: the NVIDIA board statement was distributed November8 15:00EST
(November9 05:00KST), before the original07:03:30KST cutoff. The correction adds
that official event and the company's stated position, not later market moves.
