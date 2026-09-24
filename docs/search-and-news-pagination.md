# Search, news browsing and 13F additions

2026-09-24

- Header search queries the existing server stock endpoint with a bounded `search` parameter. Scope is active US stocks/ETFs; query length is at most 60 characters and the response limit is 8. The server retains credentials and existing timeout/cache/rate limits. Arbitrary proxy paths cannot be combined with search.
- Company names and tickers have a 350 ms debounce, cancellation of outdated requests, a bounded session suggestion cache, exact-symbol priority, ArrowUp/ArrowDown/Enter selection, Escape dismissal and blur closing. Known Korean aliases cover Apple, Nvidia, Tesla, Microsoft, Amazon, Alphabet/Google, Intel and Palantir; this is not a complete Korean-name directory. Unknown Korean names should use the English issuer name or ticker. Direct uppercase ticker submission remains available during search failure.
- News loads the first diverse batch and appends further batches without changing the earlier order. Each batch has at most 12 articles, at most three per publisher; a sparse publisher mix may produce smaller batches. Remaining matching articles can all be reached, without duplicate IDs. Region/topic/query changes and explicit refresh reset to the first batch. Ordering is by date within each batch, not globally across all appended batches.
- Added Baupost Group (1061768), Dodge & Cox (200217), Third Point (1040273) to the existing SEC validation/refresh flow. Berkshire remains the default selection. No subscriptions or extra API keys are needed.

Checks: `node --test tests/news-selection.test.mjs tests/api-security.test.mjs`; `npm run build`.
