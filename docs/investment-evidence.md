# Investment notes and linked evidence

Implemented October 22, 2026. This feature stores personal research in the same browser as the existing watchlist and notes. No note, source snapshot or rationale is uploaded to an application server.

## Capture and review

- News cards (home, stock details, watchlist news and bookmarks), SEC financial history, Daily Briefing pages/home stock details, and 13F holdings/comparison rows provide **노트에 연결**.
- Stock-specific news and financial statements offer the confirmed stock as the default destination. Generic news, briefings and 13F require an explicit existing watchlist/note selection. CUSIPs are never guessed into tickers. Each 13F snapshot retains the CUSIP, class, institution CIK, report date and relevant SEC sources.
- Opening the dialog copies the source payload. Changes arriving behind the modal do not replace that copy. The user chooses support/counter/follow-up and can add a rationale. Sources are immutable after attachment; updated statements/headlines can be separate snapshots. Identical payload and annotation are deduplicated; attaching an archived duplicate restores the original ID and original capture time.
- Financial snapshots keep raw, unabridged amounts and units, accounting/cash-flow basis, fiscal period, filing date, original receipt time, stale status and calculation source inputs. Zero remains zero, negative remains negative and missing values are not manufactured. TTM is distinguished from fiscal-year and discrete-quarter values.
- Briefing snapshots keep the cutoff, session date, selected summary/stock statement, referenced sources and the corrections known at capture. News snapshots contain title/link/publication metadata, never article text. External source pages can change or disappear; this is not an archive of their bodies.
- Same-period 13F comparison snapshots retain each institution's own denominator and explicit unreported SH entries. Previous-only holdings are comparisons with the immediately preceding verified quarter, not a confirmed sale.

## Notes, history and browser safety

- Sources have immutable IDs. A judgment can reference at most 20 sources. Archiving a source removes it from the active list while preserving it for every historical reference and backup. Archived selections must be deselected before adding a new judgment; a selection-reset control preserves the prose draft.
- Attaching/archiving only changes metadata and preserves a current prose draft's revision. Every prose save reads the latest evidence list. An evidence-only blank note can accept a pre-existing unsaved first draft; an actual prose/history change still triggers the existing optimistic conflict check.
- Storage moves to `anthracite:saved:v3`, with read-only fallback to v2 then v1. Once v3 is written, old tabs writing v2 cannot strip evidence from new notes. Old keys are not deleted. A quota failure leaves the previous stored object and the draft intact; the UI reports failure, never a successful partial attachment.
- Limits: 50 notes, 100 sources per note including archived ones, 100 judgments per note, existing 4 MiB application storage limit. Sources are bounded to 24 facts and 30 source links. Only HTTP(S), credential-free links are accepted; malformed imported evidence or dangling history references reject the complete operation.

## Backup

- Export version 3 includes evidence, source values and judgment reference IDs. Versions 1 and 2 remain readable. Old application versions reject v3 backups instead of silently dropping evidence.
- Same-ticker merges keep existing prose/history and add previously unseen evidence IDs. Conflicting contents under the same evidence ID abort the merge. The current archive status wins for an identical ID. A distinct imported note restores its complete history and evidence.
- A large readable export falls back to compact JSON to remain within the existing 5 MiB import limit. Drafts are excluded as before. Backup processing remains local.

## Verification

- `tests/evidence.test.mjs`: immutable capture, draft/conflict safety, source archiving, judgment references, malformed/unsafe input, quota failure, legacy storage migration, backup round trips, merge collisions and large compact exports.
- `tests/evidence-sources.test.mjs`: news metadata, raw financial values/inputs, 13F identities/denominators and referenced briefing sources.
- `tests/e2e/evidence.spec.mjs`: desktop/mobile source attachment, judgment and archive review, backup restoration, annual/quarterly periods, explicit 13F selection, briefing capture, draft retention, Escape focus restoration and failed quota writes.
- Run the full Node suite, production build and browser suite before merging. Existing note/backup, stock, 13F and news reading-position regression checks remain in force.
