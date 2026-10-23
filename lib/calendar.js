import { FRED_RELEASES, readFREDSnapshot } from './fred-calendar.js'
import { sourceFailure, retryDeadline } from './source-retry.js'
const DAY = 86400000
const ET = 'America/New_York'
export const SOURCES = {
  fred: { name: 'FRED (BLS)', page: 'https://fred.stlouisfed.org/releases/calendar' },
  bls: { name: 'BLS', url: 'https://www.bls.gov/schedule/news_release/bls.ics', page: 'https://www.bls.gov/schedule/' },
  bea: { name: 'BEA', url: 'https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics', page: 'https://www.bea.gov/news/schedule' },
  fed: { name: 'Federal Reserve', url: 'https://www.federalreserve.gov/json/calendar.json', page: 'https://www.federalreserve.gov/newsevents/calendar.htm' },
  earnings: { name: 'Nasdaq', url: 'https://api.nasdaq.com/api/calendar/earnings', page: 'https://www.nasdaq.com/market-activity/earnings' },
}
export const dateInNY = now => new Intl.DateTimeFormat('en-CA', { timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
export const addDays = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10)
export function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
}
// Convert the wall clock using IANA rules, including daylight saving time.
export function zonedISO(date, hour, minute, zone = ET) {
  const target = Date.parse(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`)
  let result = target
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(formatter.formatToParts(result).map(p => [p.type, p.value]))
    const wall = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`)
    result += target - wall
  }
  return new Date(result).toISOString()
}
const clean = value => String(value || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const major = title => /Consumer Price Index|Producer Price Index|Employment Situation|Job Openings|Gross Domestic Product|\bGDP\b|Personal Income and Outlays|FOMC|Beige Book/i.test(title)
export function parseICS(text, source) {
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('invalid_calendar')
  const rows = text.replace(/\r?\n[ \t]/g, '').split('BEGIN:VEVENT').slice(1)
  return rows.flatMap(block => {
    if (/^STATUS:CANCELLED\s*$/m.test(block)) return []
    const field = name => block.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, 'm'))?.[1]?.trim()
    const raw = field('DTSTART'), title = field('SUMMARY')?.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1')
    const m = raw?.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/)
    if (!m || !title) return []
    const date = `${m[1]}-${m[2]}-${m[3]}`
    if (!validDate(date)) return []
    let startAt = null
    if (m[4]) {
      const tz = block.match(/^DTSTART;[^\n]*TZID=([^;:\r\n]+)/m)?.[1] || ET
      startAt = m[7] ? `${date}T${m[4]}:${m[5]}:${m[6] || '00'}Z` : zonedISO(date, Number(m[4]), Number(m[5]), tz === 'US-Eastern' ? ET : tz)
    }
    const eventDate = startAt ? dateInNY(Date.parse(startAt)) : date
    return [{ id: `${source}:${field('UID') || title + date}`, title: clean(title), category: 'Economic', date: eventDate, startAt, session: null, major: major(title), source: SOURCES[source].name, sourceUrl: SOURCES[source].page, estimated: false }]
  })
}
export function parseFed(data) {
  if (!Array.isArray(data.events)) throw new Error('invalid_fed')
  return data.events.flatMap((row) => {
    if (!['FOMC', 'Beige', 'Speeches', 'Testimony', 'Conferences', 'Other', 'Board', 'events'].includes(row.type)) return []
    const day = String(row.days).trim()
    // A date range without a precise time stays a date-only event.
    if (!/^\d{1,2}(?:\s*-\s*\d{1,2})?$/.test(day)) return []
    const date = `${row.month}-${day.split('-')[0].trim().padStart(2, '0')}`
    if (!validDate(date)) return []
    const time = String(row.time || '').match(/^(\d{1,2}):(\d{2})\s*([ap])\.?m\.?$/i)
    const startAt = time && !day.includes('-') ? zonedISO(date, Number(time[1]) % 12 + (time[3].toLowerCase() === 'p' ? 12 : 0), Number(time[2])) : null
    const title = clean(row.title)
    if (!title) return []
    return [{ id: `fed:${date}:${title}:${row.time || ''}`, title, description: clean(row.description), category: ['Conferences', 'Other', 'events'].includes(row.type) ? 'Events' : 'Fed', date, startAt, session: null, major: major(title), source: 'Federal Reserve', sourceUrl: SOURCES.fed.page, estimated: false }]
  })
}
export function parseEarnings(data, date) {
  if (!data.data || !('rows' in data.data) || (data.data.rows !== null && !Array.isArray(data.data.rows))) throw new Error('invalid_earnings')
  return (data.data.rows || []).flatMap(row => {
    if (!/^[A-Z0-9.\-]{1,16}$/.test(row.symbol || '')) return []
    return [{ id: `earnings:${date}:${row.symbol}`, title: `${row.symbol} · ${clean(row.name)}`, ticker: row.symbol, category: 'Earnings', date, startAt: null, session: row.time === 'time-pre-market' ? 'pre' : row.time === 'time-after-hours' ? 'post' : 'unknown', major: false, source: 'Nasdaq', sourceUrl: `${SOURCES.earnings.page}?date=${date}`, estimated: true }]
  })
}
// Preserve the official collection time; a fallback request is not a new verification.
export function readBLSSnapshot(snapshot, now = Date.now()) {
  const at = Date.parse(snapshot?.checkedAt)
  if (snapshot?.version !== 1 || snapshot.sourceUrl !== SOURCES.bls.url || !Number.isFinite(at) || at > now + 60000 || now - at > 7 * DAY || typeof snapshot.ics !== 'string' || !snapshot.ics.includes('END:VCALENDAR')) throw new Error('invalid_bls_snapshot')
  const events = parseICS(snapshot.ics, 'bls')
  if (!events.length || !events.some(event => event.date >= dateInNY(now))) throw new Error('empty_bls_snapshot')
  return { events, at, state: now - at > 2 * DAY ? 'stale' : 'snapshot' }
}
export function createCalendarHandler({ fetchImpl = fetch, now = Date.now, blsSnapshot = null, snapshotUrl = null, fredSnapshot = null, fredSnapshotUrl = null, timeoutMs = 15000 } = {}) {
  const cache = new Map(), pending = new Map(), failures = new Map(), snapshots = new Map()
  const TTL = 15 * 60000
  const put = (map, key, value) => { map.set(key, value); if (map.size > 90) map.delete(map.keys().next().value) }
  const empty = () => ({ events: [], at: null, state: 'unavailable' })
  const diagnostics = failure => failure ? { error: failure.error, checkedAt: failure.checkedAt, nextRetryAt: failure.nextRetryAt } : {}
  function failed(previous, error) {
    const count = Math.min(8, (previous?.failures || 0) + 1), checkedAt = now()
    return { error: error.code || 'request_failed', checkedAt, failures: count, nextRetryAt: retryDeadline(error, checkedAt, count) }
  }
  // Bound the complete request/body read, even for transports that ignore abort.
  async function download(url, parse, limit = timeoutMs) {
    const controller = new AbortController()
    let timer, reader, stage = 'request'
    try {
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => {
        controller.abort(); void reader?.cancel().catch(() => {})
        reject(sourceFailure('timeout'))
      }, limit) })
      const work = (async () => {
        const response = await fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json,text/calendar,*/*' }, signal: controller.signal, cache: 'no-store' })
        if (!response.ok) { void response.body?.cancel().catch(() => {}); throw sourceFailure(`http_${response.status}`, response.headers.get('retry-after')) }
        stage = 'read'
        if (Number(response.headers.get('content-length')) > 2 * 1024 * 1024) { void response.body?.cancel().catch(() => {}); throw sourceFailure('body_too_large') }
        reader = response.body?.getReader()
        if (!reader) throw sourceFailure('read_failed')
        const decoder = new TextDecoder()
        let raw = '', bytes = 0
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > 2 * 1024 * 1024) throw sourceFailure('body_too_large')
          raw += decoder.decode(value, { stream: true })
        }
        raw += decoder.decode(); stage = 'parse'
        return parse(raw.replace(/^\uFEFF/, ''))
      })()
      return await Promise.race([work, timeout])
    } catch (error) {
      if (controller.signal.aborted) throw sourceFailure('timeout')
      if (/^(http_\d{3}|timeout|body_too_large|read_failed|invalid_snapshot)$/.test(error?.code || '')) throw error
      throw sourceFailure(`${stage}_failed`)
    } finally { clearTimeout(timer); void reader?.cancel().catch(() => {}) }
  }
  async function snapshot(kind, bundled, url, validate) {
    const key = `snapshot:${kind}`
    if (pending.has(key)) return pending.get(key)
    const task = (async () => {
      let record = snapshots.get(kind)
      const waiting = record && now() >= record.checkedAt && now() < (record.nextRetryAt ?? record.checkedAt + TTL)
      if (url && !waiting) {
        try {
          const raw = await download(url, text => {
            const data = JSON.parse(text)
            try { validate(data, now()) } catch { throw sourceFailure('invalid_snapshot') }
            return data
          }, Math.min(timeoutMs, 5000))
          let latest = raw
          try { if (validate(record?.snapshot, now()).at > validate(raw, now()).at) latest = record.snapshot } catch { /* No previous valid snapshot. */ }
          record = { snapshot: latest, checkedAt: now() }
        } catch (error) { record = { ...failed(record, error), snapshot: record?.snapshot } }
        snapshots.set(kind, record)
      }
      // Revalidate original collection time on every read, including cache hits.
      const valid = [record?.snapshot, bundled].flatMap(raw => { try { return [validate(raw, now())] } catch { return [] } })
      const latest = valid.sort((a, b) => b.at - a.at)[0]
      return { ...(latest || empty()), ...diagnostics(record?.error ? record : null), ...(record ? { checkedAt: record.checkedAt } : {}) }
    })().finally(() => pending.delete(key))
    pending.set(key, task)
    return task
  }
  const fallbackFRED = () => snapshot('fred', fredSnapshot, fredSnapshotUrl, readFREDSnapshot)
  function retained(value, key, snapshotRetention = false) {
    const age = value ? now() - value.at : Infinity
    if (age < 0 || age > (key === 'bls' && snapshotRetention ? 7 * DAY : DAY)) return empty()
    return { ...value, state: value.state ? age > 2 * DAY ? 'stale' : value.state : 'stale' }
  }
  async function fallbackBLS(previous) {
    const saved = await snapshot('bls', blsSnapshot, snapshotUrl, readBLSSnapshot)
    const candidates = [retained(previous, 'bls', true), saved].filter(value => value.state !== 'unavailable')
    const value = candidates.sort((a, b) => b.at - a.at || Number(b.state === 'snapshot') - Number(a.state === 'snapshot'))[0] || empty()
    if (value.state !== 'unavailable') put(cache, 'bls', { events: value.events, at: value.at, state: value.state, cachedAt: now() })
    return value
  }
  async function read(key, url, parse) {
    const previous = cache.get(key)
    if (pending.has(key)) return pending.get(key)
    const failure = failures.get(key)
    if (!failure && previous && now() >= previous.at && now() - (previous.cachedAt ?? previous.at) < TTL) {
      return previous.state ? retained(previous, key, true) : { ...previous, state: 'ok', checkedAt: previous.at }
    }
    const task = (async () => {
      try {
        if (failure && now() >= failure.checkedAt && now() < failure.nextRetryAt) {
          const value = key === 'bls' && (blsSnapshot || snapshotUrl) ? await fallbackBLS(previous) : retained(previous, key)
          return { ...value, ...diagnostics(failure) }
        }
        const events = await download(url, raw => {
          if (['bls', 'bea'].includes(key) && !raw.includes('END:VCALENDAR')) throw sourceFailure('parse_failed')
          const rows = parse(raw)
          if (key === 'bls' && !rows.length) throw sourceFailure('parse_failed')
          return rows
        })
        const value = { events, at: now() }
        put(cache, key, value); failures.delete(key)
        return { ...value, state: 'ok', checkedAt: value.at }
      } catch (error) {
        const record = failed(failure, error); put(failures, key, record)
        const value = key === 'bls' && (blsSnapshot || snapshotUrl) ? await fallbackBLS(previous) : retained(previous, key)
        return { ...value, ...diagnostics(record) }
      }
    })().finally(() => pending.delete(key))
    pending.set(key, task)
    return task
  }
  return async request => {
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': status === 200 && !body.sources?.some(s => s.error || ['stale', 'unavailable'].includes(s.state)) ? 'public, s-maxage=300, stale-while-revalidate=60' : 'no-store' } })
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
    const url = new URL(request.url), today = dateInNY(now())
    const from = url.searchParams.get('from') || today
    if (!validDate(from)) return json({ error: 'Invalid date' }, 400)
    const mode = url.searchParams.get('mode') || 'all'
    if (!['all', 'month', 'earnings', 'earnings-week'].includes(mode)) return json({ error: 'Invalid mode' }, 400)
    const to = url.searchParams.get('to') || (mode === 'earnings' ? from : addDays(from, 6))
    if (!validDate(from) || !validDate(to) || to < from || Date.parse(to) - Date.parse(from) > (mode === 'month' ? 30 : mode === 'earnings' ? 0 : 6) * DAY || from < addDays(today, -62) || to > addDays(today, 124)) return json({ error: 'Invalid date range for the selected calendar mode.' }, 400)
    const jobs = (mode.startsWith('earnings') ? [] : ['bls', 'bea', 'fed']).map(source => ({ source, key: source, url: SOURCES[source].url, parse: raw => source === 'fed' ? parseFed(JSON.parse(raw)) : parseICS(raw, source) }))
    for (let date = from; mode !== 'month' && date <= to; date = addDays(date, 1)) {
      if ([0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())) continue
      jobs.push({ source: 'earnings', key: `earnings:${date}`, url: `${SOURCES.earnings.url}?date=${date}`, parse: raw => parseEarnings(JSON.parse(raw), date), date })
    }
    const results = await Promise.all(jobs.map(async job => ({ ...job, ...await read(job.key, job.url, job.parse) })))
    const bls = results.find(result => result.source === 'bls')
    if (bls && bls.state !== 'ok' && (fredSnapshot || fredSnapshotUrl)) {
      const fred = await fallbackFRED()
      if (fred && from >= fred.from && to <= fred.to && (bls.at === null || fred.at >= bls.at)) {
        // FRED replaces only the covered release families and date range, including removed dates.
        bls.events = bls.events.filter(event => event.date < fred.from || event.date > fred.to || !Object.values(FRED_RELEASES).some(title => event.title === title || event.title.startsWith(`${title} (`)))
        results.push({ source: 'fred', ...fred })
      } else if (fred.state === 'unavailable' || !fred.from || from < fred.from || to > fred.to) {
        results.push({ source: 'fred', ...empty(), ...diagnostics(fred), error: fred.error || 'snapshot_out_of_range' })
      }
    }
    const events = [...new Map(results.flatMap(r => r.events).filter(e => e.date >= from && e.date <= to).map(e => [e.id, e])).values()]
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startAt || `${a.date}T23:59:59Z`).localeCompare(b.startAt || `${b.date}T23:59:59Z`) || a.title.localeCompare(b.title))
    const sources = results.map(r => ({ name: SOURCES[r.source].name, date: r.date || null, state: r.state, updatedAt: r.at === null ? null : new Date(r.at).toISOString(), url: SOURCES[r.source].page,
      ...(r.error ? { error: r.error } : {}), ...(Number.isFinite(r.checkedAt) ? { checkedAt: new Date(r.checkedAt).toISOString() } : {}),
      ...(Number.isFinite(r.nextRetryAt) ? { nextRetryAt: new Date(r.nextRetryAt).toISOString() } : {}) }))
    return json({ from, to, dateTimezone: ET, events, sources, fetchedAt: new Date(now()).toISOString() }, results.length > 0 && results.every(r => r.state === 'unavailable') ? 503 : 200)
  }
}
