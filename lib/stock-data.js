import { json, createLimiter, clientId, crossSite } from './api-guards.js'

const ticker = '[A-Z0-9][A-Z0-9.:-]{0,19}'
const date = '\\d{4}-\\d{2}-\\d{2}'
const rules = [
  [new RegExp(`^/v3/reference/tickers/${ticker}$`), {}],
  [new RegExp(`^/v2/aggs/ticker/${ticker}/prev$`), { adjusted: ['true'] }],
  [new RegExp(`^/v1/related-companies/${ticker}$`), {}],
  [/^\/v2\/reference\/news$/, { ticker: 'ticker', limit: ['8'], order: ['desc'] }],
  [/^\/vX\/reference\/financials$/, { ticker: 'ticker', timeframe: ['annual'], limit: ['2'], order: ['desc'] }],
  [new RegExp(`^/v2/aggs/ticker/${ticker}/range/1/day/${date}/${date}$`), { adjusted: ['true'], sort: ['asc'], limit: ['365', '500'] }],
  [new RegExp(`^/v2/aggs/grouped/locale/(us/market/stocks|global/market/crypto)/${date}$`), { adjusted: ['true'] }],
]
export function allowedPath(path, now = Date.now()) {
  if (typeof path !== 'string' || path.length > 300 || !path.startsWith('/') || path.startsWith('//') || /[%\\#]/.test(path)) return null
  if (path.split('?')[0].split('/').some(part => part === '.' || part === '..')) return null
  const url = new URL(path, 'https://api.polygon.io')
  const rule = rules.find(([re]) => re.test(url.pathname))
  if (!rule) return null
  for (const [key, value] of url.searchParams) {
    const values = rule[1][key]
    if (!values || url.searchParams.getAll(key).length !== 1 || (values === 'ticker' ? !new RegExp(`^${ticker}$`).test(value) : !values.includes(value))) return null
  }
  if ('ticker' in rule[1] && !url.searchParams.has('ticker')) return null
  const dates = url.pathname.match(/\d{4}-\d{2}-\d{2}/g) || []
  for (const d of dates) {
    const time = Date.parse(d)
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== d || time < now - 1100 * 86400000 || time > now + 86400000) return null
  }
  if (dates.length === 2 && (dates[1] < dates[0] || Date.parse(dates[1]) - Date.parse(dates[0]) > 1096 * 86400000)) return null
  url.searchParams.sort()
  return url
}
export function scrub(data, secret) {
  if (typeof data === 'string') return data.split(secret).join('[redacted]').split(encodeURIComponent(secret)).join('[redacted]')
  if (Array.isArray(data)) return data.map(x => scrub(x, secret))
  if (data && typeof data === 'object') return Object.fromEntries(Object.entries(data).filter(([k]) => !['next_url', 'apiKey', 'api_key'].includes(k)).map(([k, v]) => [k, scrub(v, secret)]))
  return data
}
export function createStockHandler({ getKey = () => process.env.POLYGON_KEY || process.env.VITE_POLYGON_KEY, fetchImpl = fetch, now = Date.now } = {}) {
  const cache = new Map(); const pending = new Map()
  const limit = createLimiter(120, 60000, now)
  async function dataFor(url, key) {
    const id = url.href; const hit = cache.get(id)
    if (hit && hit.until > now()) return hit.data
    if (pending.has(id)) return pending.get(id)
    const task = (async () => {
      const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${key}` }, redirect: 'error', signal: AbortSignal.timeout(20000) })
      if (!response.ok) throw new Error('upstream')
      const data = scrub(await response.json(), key)
      // The legacy overview only needs these instruments, not the complete market.
      if (url.pathname.includes('/grouped/')) data.results = (data.results || []).filter(r => ['QQQ','SPY','DIA','IWM','SOXX','GLD','SLV','USO','VIXY','X:BTCUSD'].includes(r.T))
      if (cache.size >= 200) cache.delete(cache.keys().next().value)
      cache.set(id, { data, until: now() + 60000 })
      return data
    })()
    pending.set(id, task)
    try { return await task } finally { pending.delete(id) }
  }
  return async req => {
    if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' })
    if (crossSite(req)) return json({ error: 'Forbidden' }, 403)
    const query = new URL(req.url).searchParams
    if ([...query.keys()].some(k => !['path', 'logo', 'search'].includes(k)) || query.getAll('path').length > 1 || query.getAll('logo').length > 1 || (query.has('logo') && query.has('path'))) return json({ error: 'Invalid request' }, 400)
    const search = query.get('search')
    if (query.has('search') && (query.size !== 1 || !search || search.length > 60 || !/^[\p{L}\p{N} .&'-]+$/u.test(search) || !search.trim())) return json({ error: 'Invalid search' }, 400)
    const logo = query.get('logo')
    let url = logo && new RegExp(`^${ticker}$`).test(logo) ? new URL(`/v3/reference/tickers/${logo}`, 'https://api.polygon.io') : !logo ? allowedPath(query.get('path'), now()) : null
    if (search) {
      url = new URL('/v3/reference/tickers', 'https://api.polygon.io')
      url.search = new URLSearchParams({ search: search.trim(), market: 'stocks', locale: 'us', active: 'true', limit: '8', sort: 'ticker', order: 'asc' }).toString()
    }
    if (!url) return json({ error: 'Invalid request' }, 400)
    if (!limit(clientId(req))) return json({ error: 'Too many requests' }, 429, { 'Retry-After': '60' })
    const key = getKey()
    if (!key) return json({ error: 'Market data not configured' }, 503)
    try {
      const data = await dataFor(url, key)
      if (!logo) return json(data, 200, { 'Cache-Control': 'public, s-maxage=60' })
      const icon = new URL(data.results?.branding?.icon_url)
      if (icon.origin !== 'https://api.polygon.io' || !icon.pathname.startsWith('/v1/reference/company-branding/') || icon.username || icon.password) return json({ error: 'Logo unavailable' }, 404)
      icon.search = ''
      const response = await fetchImpl(icon, { headers: { Authorization: `Bearer ${key}` }, redirect: 'error', signal: AbortSignal.timeout(10000) })
      const type = response.headers.get('content-type')?.split(';')[0]
      if (!response.ok || !['image/png','image/jpeg','image/webp','image/x-icon','image/vnd.microsoft.icon'].includes(type)) return json({ error: 'Logo unavailable' }, 404)
      const bytes = await response.arrayBuffer()
      if (bytes.byteLength > 1024 * 1024) return json({ error: 'Logo unavailable' }, 404)
      return new Response(bytes, { headers: { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, s-maxage=86400' } })
    } catch { return json({ error: logo ? 'Logo unavailable' : 'Market data temporarily unavailable' }, logo ? 404 : 503) }
  }
}
