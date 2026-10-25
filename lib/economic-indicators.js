import { economicDefinitions, validEconomicSnapshot, economicStatus, economicFailureReasonSchema } from './economic-series.js'
export const BLS_API = 'https://api.bls.gov/publicAPI/v1/timeseries/data/'
export const NYFED_API = 'https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json'
export function parseBLS(data, seriesId) {
  if (data?.status !== 'REQUEST_SUCCEEDED') throw new Error(Array.isArray(data?.message) && data.message.some(m => typeof m === 'string' && /(?:daily|query|request).*(?:limit|quota)|too many requests/i.test(m)) ? 'bls_rate_limited' : 'bls_request_failed')
  const matches = data.Results?.series?.filter(s => s.seriesID === seriesId)
  if (matches?.length !== 1 || !Array.isArray(matches[0].data)) throw new Error('bls_series_missing')
  const observations = matches[0].data.filter(p => /^M(0[1-9]|1[0-2])$/.test(p.period)).map(p => {
    if (!/^\d{4}$/.test(p.year) || !/^(?:\d+(?:\.\d+)?|-)$/.test(p.value)) throw new Error('invalid_bls_observation')
    const note = (p.footnotes || []).map(f => f.text).filter(Boolean).join('; ').slice(0, 500)
    return { date: `${p.year}-${p.period.slice(1)}-01`, value: p.value === '-' ? null : Number(p.value), ...(note ? { note } : {}) }
  }).sort((a, b) => a.date.localeCompare(b.date))
  if (observations.length < 24 || !observations.some(p => p.value !== null)) throw new Error('bls_history_missing')
  return observations
}
export function parseEFFR(data) {
  if (!Array.isArray(data?.refRates) || data.refRates.length < 24) throw new Error('effr_history_missing')
  return data.refRates.map(p => {
    if (p.type !== 'EFFR' || typeof p.percentRate !== 'number') throw new Error('invalid_effr_observation')
    return { date: p.effectiveDate, value: p.percentRate, ...(p.revisionIndicator ? { note: `뉴욕 연준 수정 표시: ${String(p.revisionIndicator).slice(0, 100)}` } : {}) }
  }).sort((a, b) => a.date.localeCompare(b.date))
}
export const emptyEconomicSnapshot = () => ({ version: 1, series: economicDefinitions.map(d => ({ id: d.id, collectedAt: null, attemptedAt: null, error: 'unavailable', observations: [] })) })
export async function collectEconomicSnapshot({ previous = emptyEconomicSnapshot(), fetchImpl = fetch, now = Date.now(), wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  if (!validEconomicSnapshot(previous, now)) throw new Error('invalid_previous_snapshot')
  const today = new Date(now).toISOString().slice(0, 10), year = Number(today.slice(0, 4)), at = new Date(now).toISOString()
  const download = async (url, options = {}) => {
    // At most three requests per provider. Never retry access denial or malformed
    // data. Rate limits require an explicit, short Retry-After; daily quotas wait
    // for the next scheduled run instead of being repeatedly requested.
    for (let attempt = 0; attempt < 3; attempt++) {
      let retryable = false, delay = 1000 * 2 ** attempt
      try {
        let r
        try { r = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(20000) }) }
        catch (error) {
          retryable = true
          throw new Error(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'network_error')
        }
        if (!r.ok) {
          retryable = [408, 500, 502, 503, 504].includes(r.status)
          const retryAfter = r.headers.get('retry-after')
          if (retryAfter !== null) {
            const ms = /^\d+$/.test(retryAfter.trim()) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - now
            // Respect long or malformed instructions by leaving the retry to a
            // future run, rather than shortening the provider's requested wait.
            if (Number.isFinite(ms) && ms >= 0 && ms <= 30000) {
              delay = Math.max(delay, ms)
              if (r.status === 429) retryable = true
            } else retryable = false
          }
          await r.body?.cancel()
          throw new Error(`http_${r.status}`)
        }
        let text
        try { text = await r.text() }
        catch (error) {
          retryable = true
          throw new Error(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout' : 'network_error')
        }
        if (text.length > 3000000) throw new Error('response_too_large')
        try { return JSON.parse(text) } catch { throw new Error('invalid_json') }
      } catch (error) {
        if (!retryable || attempt === 2) throw error
        await wait(delay)
      }
    }
  }
  // One BLS call for both series; seven calendar years include the CPI base year.
  const [bls, fed] = await Promise.allSettled([
    download(BLS_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seriesid: ['CUUR0000SA0', 'LNS14000000'], startyear: String(year - 6), endyear: String(year) }) }),
    download(`${NYFED_API}?startDate=${year - 5}-01-01&endDate=${today}`),
  ])
  const series = economicDefinitions.map((d, i) => {
    try {
      const result = d.id === 'effr' ? fed : bls
      if (result.status !== 'fulfilled') throw result.reason
      const observations = d.id === 'effr' ? parseEFFR(result.value) : parseBLS(result.value, d.seriesId)
      const entry = { id: d.id, collectedAt: at, attemptedAt: at, error: null, failureReason: null, observations }
      const candidate = { version: 1, series: previous.series.map((s, j) => j === i ? entry : s) }
      if (!validEconomicSnapshot(candidate, now) || observations.at(-1).date < (previous.series[i].observations.at(-1)?.date || '')) throw new Error('invalid_or_regressed_series')
      return entry
    } catch (error) {
      const reason = economicFailureReasonSchema.safeParse(error?.message)
      return { ...previous.series[i], attemptedAt: at, error: 'unavailable', failureReason: reason.success ? reason.data : 'unexpected_error' }
    }
  })
  return { version: 1, series }
}
export function createEconomicHandler({ snapshot, snapshotUrl, fetchImpl = fetch, now = Date.now } = {}) {
  let cached = snapshot, checkedAt = -Infinity, pending
  async function read() {
    if (!snapshotUrl || now() - checkedAt < 15 * 60000) return
    if (pending) return pending
    pending = (async () => {
      try {
        const r = await fetchImpl(snapshotUrl, { signal: AbortSignal.timeout(5000), cache: 'no-store' })
        if (!r.ok) throw new Error('snapshot_unavailable')
        const text = await r.text()
        if (text.length > 1000000) throw new Error('snapshot_too_large')
        const candidate = JSON.parse(text)
        if (!validEconomicSnapshot(candidate, now())) throw new Error('invalid_snapshot')
        const base = validEconomicSnapshot(cached, now()) ? cached : emptyEconomicSnapshot()
        cached = { version: 1, series: candidate.series.map((s, i) => (s.collectedAt || '') >= (base.series[i].collectedAt || '') && (s.attemptedAt || '') >= (base.series[i].attemptedAt || '') ? s : base.series[i]) }
      } catch { /* The original collection time on the bundled data remains authoritative. */ }
      finally { checkedAt = now(); pending = null }
    })()
    return pending
  }
  return async req => {
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': status === 200 ? 'public, s-maxage=900, stale-while-revalidate=60' : 'no-store' } })
    if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
    if (new URL(req.url).search) return json({ error: 'No query parameters supported' }, 400)
    await read()
    if (!validEconomicSnapshot(cached, now())) return json({ error: 'Economic data unavailable' }, 503)
    const series = cached.series.map(s => ({ ...s, observations: economicStatus(s, now()) === 'unavailable' ? [] : s.observations }))
    return json({ version: 1, series }, series.every(s => !s.observations.length) ? 503 : 200)
  }
}
