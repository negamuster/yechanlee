# Website audit follow-up

Base: `480965f85d0ccc980716294fdc0bffec23fb4b08`. Implement in this order:

1. Simulator: use validated projection ages for every chart coordinate/tick. Ages 0 and 100 must agree between chart and table; invalid ages must terminate promptly and show guidance. Preserve all financial formulas and units.
2. Economic observations: diagnose current BLS failures, recover official collection where accessible, and add bounded transient retries with safe reason codes. Preserve previous observations and original collection time on failure; never invent successful timestamps or replace missing values with zero. Keep CPI, U-3 and EFFR definitions and adjustment bases unchanged.
3. Lint: resolve existing errors/warnings with behavioral fixes or precise tool corrections, then make lint a shared local/CI check. Avoid blanket rule suppression.

Validation: focused Node/DOM regression tests after each step; final Node suite, lint, production build and desktop/mobile Chromium CI on the integrated revision. Independently review final implementation and failure cases. Local browser installation and actual mobile/Safari availability are reported separately. PR preparation does not authorize main merge or production deployment.

Economic source access failures may remain outside this repository's control. Report live collection outcome separately from fixture-based recovery tests, with sanitized error categories and source timestamps.
