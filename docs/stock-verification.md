# Stock lookup verification

## Pull request checks

`Verify site changes` runs `npm test`, a production build, and Playwright in Chromium. The browser suite covers stock lookup plus charts, economic indicators, collection status, 13F, investment evidence, note discovery and backup status. Each scenario runs at desktop and Pixel 7 viewport sizes. Stock lookup scenarios include:

- Search for a company, open its stock page and select all eight chart periods; check English dates and horizontal overflow.
- Recover missing company metadata and news while confirmed prices and SEC financials remain available.
- Retain confirmed values and their original receipt timestamps during partial refresh failure; clear old lists after a successful empty response.
- Reject a conflicting company ticker, then recover on retry.
- Navigate to another company while an earlier chart request is pending; reject the late series.

These browser tests use synthetic AAPL/NVDA/SATL responses and a fixed clock. External requests are blocked; no provider keys or production API quota are used. Pixel 7 is a Chromium viewport/device emulation, not a physical device or Safari check. Failed tests publish screenshots, traces and an HTML report for seven days.

```sh
npm ci
npm run setup:browsers
npm run verify:all
```

For Node tests and build only, use `npm run verify`. After a successful build of the same revision, `npm run test:e2e` adds browser checks without repeating Node tests and build. Browser installation is separate from verification and must succeed before browser results can be reported. See the [README](../README.md) for Node version, development setup, static-preview limitations and the command reference. CI retains separate steps so each outcome remains visible.

## Production checks

`Check production data health` retains the existing news/market/calendar probes and adds nine stock probes: company details, daily history, previous close, company news, related companies, SEC annual financials and charts for 1D/1M/ALL.

The workflow runs every six hours, on manual dispatch, and after successful main-branch push verification. It skips superseded revisions and waits up to three minutes for the exact main commit in the public `/build-info.json` marker. The build script writes only the commit SHA, using `VERCEL_GIT_COMMIT_SHA` on Vercel. A missing or old marker fails the gate instead of reporting on the previous deployment. No Vercel token is needed.

One representative company rotates per six-hour slot: AAPL, NVDA, SATL. Massive request starts are spaced by at least 20 seconds with no retries. A 429 skips remaining Massive probes while SEC and Yahoo probes continue. This is local pacing within this job; visitors and other server instances can still share the upstream allowance.

Shared Zod contracts validate ticker identity, numeric values, annual periods/units, valid dates, chart ordering and response shape in both the page and the health checker. Production checks additionally require reference-company coverage and recent prices. Ten calendar days allow for weekends and ordinary holidays. Empty news/related lists are warnings; missing required prices or malformed responses fail the check. Original provider receipt and observation times are retained in the report; missing values never become zero.

```sh
npm run check:stocks
npm run check:stocks -- --symbol AAPL
npm run check:data # includes existing global feeds
```

These commands call the deployed production site, not the local development or preview server. They are deliberately excluded from `verify` and `verify:all`, because they can consume upstream quota and depend on live source availability. Unlike the deployment workflow, these direct commands do not first wait for a specific deployed SHA; check `/build-info.json` separately when verifying a deployment.

Reports appear in the Actions step summary and `production-data-health` JSON artifact (seven-day retention), including per-resource OK/WARN/FAIL/SKIP details without raw upstream bodies. Workflow failures remain visible in GitHub Actions; this change does not configure a separate notification channel. The new post-deployment trigger becomes active after merging to main.
