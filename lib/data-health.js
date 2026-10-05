const HOUR = 3600000
export function inspectHealth(name, data, now = Date.now()) {
  const errors = [], warnings = []
  const age = value => { const time = typeof value === 'number' ? value : Date.parse(value); return Number.isFinite(time) ? now - time : Infinity }
  if (!data || typeof data !== 'object') return { errors: ['Invalid response'], warnings }
  if (name === 'news') {
    if (!Array.isArray(data.items) || !data.items.length) errors.push('No news items')
    if (age(data.fetchedAt) > 2 * HOUR) errors.push('News collection older than 2 hours')
    const unavailable = data.sources?.filter(s => s.status === 'unavailable') || []
    if (unavailable.length) warnings.push(`Unavailable feeds: ${unavailable.map(s => `${s.id || s.publisher} (${s.error || 'unknown error'})`).join(', ')}`)
    const unconfigured = data.sources?.filter(s => s.status === 'not_configured') || []
    if (unconfigured.length) warnings.push(`Feeds not configured: ${unconfigured.map(s => s.id || s.publisher).join(', ')}`)
    if (data.items?.length && data.items.every(a => age(a.published_utc) > 72 * HOUR)) errors.push('All articles older than 72 hours')
  } else if (name === 'indices') {
    const ok = data.quotes?.filter(q => q.status === 'ok') || []
    if (!ok.length) errors.push('All market quotes unavailable')
    if (ok.some(q => age(q.asOf) > 7 * 24 * HOUR)) warnings.push('Some quotes older than 7 days')
    if (data.quotes?.some(q => q.status !== 'ok')) warnings.push('Some instruments unavailable')
    if (age(data.fetchedAt) > 2 * HOUR) errors.push('Quote response older than 2 hours')
  } else if (name === 'movers') {
    if (!data.tradingDate || !data.rankings || !['turnover', 'gainers', 'losers'].every(k => Array.isArray(data.rankings[k]))) errors.push('Invalid rankings')
    if (age(data.tradingDate) > 10 * 24 * HOUR) errors.push('Trading date older than 10 days')
    if (data.stale) errors.push('Market Movers refresh failed')
    if (age(data.fetchedAt) > 48 * HOUR) errors.push('Rankings collection older than 48 hours')
  } else if (name === 'maps') {
    if (!Array.isArray(data.sectors) || !data.sectors.length || !data.benchmark) errors.push('Missing sector data')
    if (age(data.benchmark?.asOf) > 10 * 24 * HOUR) errors.push('Benchmark older than 10 days')
    if (data.stale) errors.push('Maps refresh failed')
    if (age(data.fetchedAt) > 48 * HOUR) errors.push('Sector collection older than 48 hours')
  } else if (name === 'calendar') {
    if (!Array.isArray(data.events) || !Array.isArray(data.sources)) errors.push('Invalid calendar response')
    const sources = data.sources || []
    if (!sources.some(s => ['ok', 'snapshot'].includes(s.state))) errors.push('No current calendar source')
    const limited = sources.filter(s => ['stale', 'unavailable'].includes(s.state))
    if (limited.length) warnings.push(`Limited calendar sources: ${limited.map(s => `${s.name}: ${s.state}, checked ${s.updatedAt || 'unknown'}`).join('; ')}${sources.some(s => s.name === 'FRED (BLS)' && ['ok', 'snapshot'].includes(s.state)) ? '; FRED covers 9 BLS release families only' : ''}`)
    if (sources.some(s => ['ok', 'snapshot'].includes(s.state) && age(s.updatedAt) > 48 * HOUR)) warnings.push('Some source checks older than 48 hours')
  }
  return { errors, warnings }
}
