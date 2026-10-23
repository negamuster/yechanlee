import { collectNews, currentNewsPayload, MAX_AGE } from './news.js'

// Use Vercel's Node.js Web Standard handler so production uses the same runtime
// as the feed collector's integration tests. Other API routes remain unchanged.
export function createNewsHandler({ now = Date.now } = {}) {
  const feedCache = new Map()
  const TTL = 10 * 60 * 1000
  let cached = null
  let inFlight = null

  async function handler(req) {
    if (req.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } })
    try {
      if (!cached || now() - cached.fetchedAt >= TTL) {
        if (!inFlight) {
          inFlight = collectNews(fetch, undefined, now(), 10000, feedCache).then(result => {
            if (result.items.length) cached = result
            return result
          }).finally(() => { inFlight = null })
        }
        const result = await inFlight
        if (!result.items.length) {
          return Response.json(result, { status: 503, headers: { 'Cache-Control': 'no-store' } })
        }
      }
      // A response-cache hit must not extend the per-source retention deadline.
      const payload = currentNewsPayload(cached, now())
      if (!payload.items.length) return Response.json(payload, { status: 503, headers: { 'Cache-Control': 'no-store' } })
      // A CDN hit can bypass origin pruning. Freshness + SWR must fit before expiry.
      const remaining = Math.floor(Math.min(...payload.items.map(item => Date.parse(item.published_utc) + MAX_AGE - now())) / 1000)
      const fresh = Math.min(300, remaining), revalidate = Math.min(300, Math.max(0, remaining - fresh))
      return Response.json(payload, {
        headers: { 'Cache-Control': payload.items.some(item => item.feedStale) || remaining <= 1 ? 'no-store' : `public, max-age=0, s-maxage=${fresh}, stale-while-revalidate=${revalidate}` },
      })
    } catch {
      return Response.json({ error: 'News temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
  }

  return handler

}
