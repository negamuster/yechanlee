export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
})

// Instance-local protection; use a platform firewall for distributed enforcement.
export function createLimiter(limit, windowMs, now = Date.now) {
  const buckets = new Map()
  return key => {
    const time = now()
    for (const [id, bucket] of buckets) if (bucket.until <= time) buckets.delete(id)
    let bucket = buckets.get(key)
    if (!bucket) {
      if (buckets.size >= 5000) return false
      bucket = { count: 0, until: time + windowMs }; buckets.set(key, bucket)
    }
    return ++bucket.count <= limit
  }
}
export function clientId(req) {
  return req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'local'
}
export function crossSite(req) {
  const origin = req.headers.get('origin')
  return req.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(req.url).origin)
}
export async function readJson(req, maxBytes) {
  if (!req.headers.get('content-type')?.startsWith('application/json')) throw new Error('type')
  const reader = req.body?.getReader()
  if (!reader) throw new Error('body')
  const chunks = []; let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) { await reader.cancel(); throw new Error('size') }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return JSON.parse(new TextDecoder().decode(bytes))
}
