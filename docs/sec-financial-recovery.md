# SEC financial API recovery

Goal: restore reference-company financials across cold deployments when direct
SEC access fails, distinguish collection stages, and prevent repeated upstream
failure requests. Preserve SEC issuer identity, units/periods/filings, original
receipt times and the existing seven-day retention limit. No proxy or paid API.

Evidence before change: production NVDA and AAPL requests returned HTTP 503. The same
handler locally obtained HTTP 200 for both the ticker map and NVDA company facts, then generated
5 annual / 8 quarterly / 1 TTM rows without an exception. This does not establish the
exact failure inside Vercel: the old 503 response swallowed HTTP, parse and conversion errors.
New fixed diagnostics must distinguish those failures instead of asserting HTTP 403.

Scope: initial verified snapshot coverage AAPL / NVDA / SATL (configurable collection
list), existing hourly SEC-monitor workflow, same financialHistory converter and
stock contracts. Other tickers still use live SEC and honestly fail when no valid
retained data exists. Do not claim full-universe fallback coverage.

Completion: test cold fallback, issuer mismatch, expiry, concurrent failures,
retry deadlines, partial collection, valid empty results and live recovery; run
lint, full Node tests, build, desktop and mobile Chromium and independent final-tree review.
Merge/production requires the user's separate request per AGENTS.md. A snapshot
response is stale after a failed live refresh and must retain its true fetchedAt.

The collector is bounded to 20 distinct configured tickers, runs serially with
the existing SEC request pacing, and uses no paid key. Collection failures keep
prior receipts and are recorded explicitly; an incomplete run still fails the
existing workflow after saving valid partial results. Backoff is per warm
function instance, not a distributed SEC-wide quota. The first failed request
can still wait for the existing 20-second upstream deadline.
