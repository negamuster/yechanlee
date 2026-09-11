import { collectNews } from '../lib/news.js'

// Use Vercel's Node.js Web Standard handler so production uses the same runtime
// as the feed collector's integration tests. Other API routes remain unchanged.
const TTL = 10 * 60 * 1000
let cached = null
let inFlight = null

async function handler(req) {
  if (req.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } })
  try {
    if (!cached || Date.now() - cached.fetchedAt >= TTL) {
      if (!inFlight) {
        inFlight = collectNews().then(result => {
          if (result.items.length) cached = result
          return result
        }).finally(() => { inFlight = null })
      }
      const result = await inFlight
      if (!result.items.length) {
        return Response.json(result, { status: 503, headers: { 'Cache-Control': 'no-store' } })
      }
    }
    return Response.json(cached, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300' },
    })
  } catch {
    return Response.json({ error: 'News temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

export default { fetch: handler }
