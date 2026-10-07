import { collectNews } from './news.js'

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
      const payload = { ...cached, items: cached.items.filter(item => !item.feedStale || now() - item.feedCollectedAt <= 6 * 3600000) }
      if (!payload.items.length) return Response.json(payload, { status: 503, headers: { 'Cache-Control': 'no-store' } })
      return Response.json(payload, {
        headers: { 'Cache-Control': payload.items.some(item => item.feedStale) ? 'no-store' : 'public, max-age=0, s-maxage=300, stale-while-revalidate=300' },
      })
    } catch {
      return Response.json({ error: 'News temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
  }

  return handler

}
