# API security rollout

## Changes

- Browser code uses `/api/stock-data`; credentials are only sent server-to-server using Authorization headers. Only the app's known paths, query parameters, symbols and bounded dates are allowed. No arbitrary URL or redirect proxying.
- Company icons use the same server endpoint. Only Polygon's company-branding path and raster image MIME types are accepted. JSON responses are scrubbed and upstream error bodies are not forwarded.
- Successful stock JSON calls cache/coalesce for 60 seconds per instance. Stock requests have a 120/minute per-client instance-local cap.
- AI accepts only `{ prompt }`, at most 6,000 characters / 16 KB. Model and 800 output tokens are server controlled, with a 25-second timeout. No caller-supplied tools, system prompts or model settings.
- AI has 3 requests/client/minute and 20 upstream calls/minute per instance. Identical results are cached for 15 minutes, concurrent requests coalesce. Errors are not cached.
- Cross-site browser requests are rejected and wildcard CORS removed. Origin checks are not authentication; scripts can forge headers.
- Vite exposes only the public video-ID setting. The previously committed environment file is now a harmless placeholder; private settings belong in ignored `.env.local`.

## Required owner follow-up

1. Rotate the previously exposed Polygon key in the provider dashboard. Removing it from current code does not revoke old bundles or Git history. Do not paste keys in chat.
2. Set the replacement as `POLYGON_KEY` in Vercel Production and Preview environment settings, then redeploy. Remove `VITE_POLYGON_KEY` after migration. A temporary server-only fallback keeps existing deployments functional until rotation.
3. Locally set `POLYGON_KEY=...` in `.env.local`, restart Vite. Use `ANTHROPIC_API_KEY=...` there only if testing AI locally. Never commit either.
4. Configure Vercel Firewall rate limiting for `/api/claude-proxy` (for example 3 POST requests/IP/minute), and appropriate provider spending limits. Instance-local limits reset on cold starts and do not provide a global spending ceiling. A durable counter or platform firewall is needed for distributed enforcement. No firewall/provider settings were changed by this code rollout.

## Verification

`node --test tests/api-security.test.mjs`

`npm run build`

Security tests cover route/parameter bypasses, secret redaction, branding host restrictions, caching, fixed model/output settings, input bounds, rate limits, cross-site rejection and concurrent failure handling. No paid AI call is needed for the tests.
