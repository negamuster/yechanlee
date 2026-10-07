# API security rollout

## Changes

- Browser code uses `/api/stock-data`; credentials are only sent server-to-server using Authorization headers. Only the app's known paths, query parameters, symbols and bounded dates are allowed. No arbitrary URL or redirect proxying.
- Company icons use the same server endpoint. Only Polygon's company-branding path and raster image MIME types are accepted. JSON responses are scrubbed and upstream error bodies are not forwarded.
- Successful stock JSON calls cache/coalesce for 60 seconds per instance. Stock requests have a 120/minute per-client instance-local cap.
- Paid AI analysis was retired on 2026-10-07. The legacy `/api/claude-proxy` endpoint returns HTTP 410 for same-origin POST requests and never reads credentials or calls a provider. The stock page has no AI analysis control.
- Cross-site browser requests are rejected and wildcard CORS removed. Origin checks are not authentication; scripts can forge headers.
- Vite exposes only the public video-ID setting. The previously committed environment file is now a harmless placeholder; private settings belong in ignored `.env.local`.

## Required owner follow-up

1. Rotate the previously exposed Polygon key in the provider dashboard. Removing it from current code does not revoke old bundles or Git history. Do not paste keys in chat.
2. Set the replacement as `POLYGON_KEY` in Vercel Production and Preview environment settings, then redeploy. Remove `VITE_POLYGON_KEY` after migration. A temporary server-only fallback keeps existing deployments functional until rotation.
3. Locally set `POLYGON_KEY=...` in `.env.local`, restart Vite. Never commit credentials.
4. Remove any obsolete `ANTHROPIC_API_KEY` from deployment settings when convenient. The retired endpoint does not use it. No provider or firewall settings were changed by this rollout.

## Verification

`node --test tests/api-security.test.mjs`

`npm run build`

Security tests cover route/parameter bypasses, secret redaction, branding host restrictions, caching, retired AI endpoint behavior with zero credential/provider calls, and cross-site rejection. No paid AI call is needed for the tests.
