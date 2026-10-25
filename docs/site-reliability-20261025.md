# Website audit follow-up

Base: `480965f85d0ccc980716294fdc0bffec23fb4b08`. Implement in this order:

1. Simulator: use validated projection ages for every chart coordinate/tick. Ages 0 and 100 must agree between chart and table; invalid ages must terminate promptly and show guidance. Preserve all financial formulas and units.
2. Economic observations: diagnose current BLS failures, recover official collection where accessible, and add bounded transient retries with safe reason codes. Preserve previous observations and original collection time on failure; never invent successful timestamps or replace missing values with zero. Keep CPI, U-3 and EFFR definitions and adjustment bases unchanged.
3. Lint: resolve existing errors/warnings with behavioral fixes or precise tool corrections, then make lint a shared local/CI check. Avoid blanket rule suppression.

Validation: focused Node/DOM regression tests after each step; final Node suite, lint, production build and desktop/mobile Chromium CI on the integrated revision. Independently review final implementation and failure cases. Local browser installation and actual mobile/Safari availability are reported separately. PR preparation does not authorize main merge or production deployment.

Economic source access failures may remain outside this repository's control. Report live collection outcome separately from fixture-based recovery tests, with sanitized error categories and source timestamps.

## Economic collection contract

- Both BLS monthly series remain in one POST for seven calendar years. The request is within the [BLS v1 ten-year/25-series limits](https://www.bls.gov/developers/api_signature.htm); no key, alternate series or source substitution is introduced.
- Each provider makes at most three attempts, each with a 20-second timeout. Retry only network/body interruption, timeout and HTTP 408/500/502/503/504, with 1s/2s backoff. HTTP 429 requires a valid `Retry-After` no longer than 30 seconds. Longer/malformed instructions defer to the next run. Access denials, invalid JSON, oversized data, application-level rejection and validation/regression failures do not retry.
- Existing v1 snapshots remain accepted. Optional `failureReason` contains an allowlisted code (including HTTP status), never raw response bodies or exception details. Successful collection clears the code; failure keeps the original observations and `collectedAt`, changes only `attemptedAt`/failure status, and lets independently successful series advance. Collection logs show the code and both timestamps.
- On 2026-10-25 at 15:35 KST the revised collector exhausted its bounded BLS retries with `http_503`; CPI/U-3 retained their 2026-10-24 05:01 KST receipt and September observation. NY Fed succeeded. This verifies failure handling, not live BLS recovery. No replacement snapshot from this unsuccessful local run is committed.
- Retrying the existing failed production workflow also failed collection; its old checkout then conflicted with newer economic data during rebase, so nothing was pushed. Future runs check out current main and log the actual collector revision, avoiding that obsolete-base retry failure. BLS recovery still requires a successful live collection after source availability returns.

## Lint and UI state

- No lint rules were disabled. ECharts registration has a non-hook alias; the saved-items context/hook moves out of the component module for Fast Refresh. Existing storage keys, writes, backup formats and financial formulas are unchanged.
- Search results and stock snapshot state carry their request identity. Pending/error/empty states derive from the current request instead of clearing state synchronously inside effects; aborted and late results cannot populate a different query/symbol. Existing search debounce, cache, timeout and explicit ticker recovery remain.
- Chart initialization/cleanup follows the canvas ref lifecycle. Committed bars are synchronized to event refs after commit; data changes preserve a manually selected timestamp range or fit the full new series. Canvas-unavailable fallback remains accessible.
- `lint` now fails on warnings; `verify` and the PR/main CI include it. The CI summary records lint independently and lint-config pushes trigger verification. Build chunk-size warnings remain a separate, existing performance item.
- Initial integrated local verification: zero ESLint errors/warnings, 418 Node tests passed, TypeScript/production build passed; Playwright discovers 66 desktop/mobile cases. Local Chromium execution remains unavailable from the previously failed browser download; CI browser execution is recorded separately in the PR.
- Independent review of `f82d5ebaaf5be035a88883cf54466a8cad9092b2` found no confirmed production blocker; 34 targeted tests passed independently. A chart recreated for currency/period changes with an unchanged bars reference also needs its data effect rerun. Added those initialization dependencies; final revision/CI and follow-up review are recorded in the PR.
