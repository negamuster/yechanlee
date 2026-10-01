const DAY = 86400000
const ET = 'America/New_York'
export const SOURCES = {
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
export function createCalendarHandler({ fetchImpl = fetch, now = Date.now } = {}) {
  const cache = new Map(), pending = new Map()
  async function read(key, url, parse) {
    const previous = cache.get(key)
    if (previous && now() - previous.at < 15 * 60000) return { ...previous, state: 'ok' }
    if (pending.has(key)) return pending.get(key)
    const task = (async () => {
      try {
        const response = await fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json,text/calendar,*/*' }, signal: AbortSignal.timeout(15000) })
        if (!response.ok) throw new Error('unavailable')
        const raw = (await response.text()).replace(/^\uFEFF/, '')
        const value = { events: parse(raw), at: now() }
        cache.set(key, value)
        if (cache.size > 90) cache.delete(cache.keys().next().value)
        return { ...value, state: 'ok' }
      } catch {
        return previous && now() - previous.at < 24 * 3600000 ? { ...previous, state: 'stale' } : { events: [], at: null, state: 'unavailable' }
      } finally { pending.delete(key) }
    })()
    pending.set(key, task)
    return task
  }
  return async request => {
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': status === 200 ? 'public, s-maxage=300, stale-while-revalidate=60' : 'no-store' } })
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
    const url = new URL(request.url), today = dateInNY(now())
    const from = url.searchParams.get('from') || today
    if (!validDate(from)) return json({ error: 'Invalid date' }, 400)
    const mode = url.searchParams.get('mode') || 'all'
    if (!['all', 'month', 'earnings'].includes(mode)) return json({ error: 'Invalid mode' }, 400)
    const to = url.searchParams.get('to') || (mode === 'earnings' ? from : addDays(from, 6))
    if (!validDate(from) || !validDate(to) || to < from || Date.parse(to) - Date.parse(from) > (mode === 'month' ? 30 : mode === 'earnings' ? 0 : 6) * DAY || from < addDays(today, -62) || to > addDays(today, 124)) return json({ error: 'Invalid date range for the selected calendar mode.' }, 400)
    const jobs = (mode === 'earnings' ? [] : ['bls', 'bea', 'fed']).map(source => ({ source, key: source, url: SOURCES[source].url, parse: raw => source === 'fed' ? parseFed(JSON.parse(raw)) : parseICS(raw, source) }))
    for (let date = from; mode !== 'month' && date <= to; date = addDays(date, 1)) {
      if ([0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())) continue
      jobs.push({ source: 'earnings', key: `earnings:${date}`, url: `${SOURCES.earnings.url}?date=${date}`, parse: raw => parseEarnings(JSON.parse(raw), date), date })
    }
    const results = await Promise.all(jobs.map(async job => ({ ...job, ...await read(job.key, job.url, job.parse) })))
    const events = [...new Map(results.flatMap(r => r.events).filter(e => e.date >= from && e.date <= to).map(e => [e.id, e])).values()]
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startAt || `${a.date}T23:59:59Z`).localeCompare(b.startAt || `${b.date}T23:59:59Z`) || a.title.localeCompare(b.title))
    const sources = results.map(r => ({ name: SOURCES[r.source].name, date: r.date || null, state: r.state, updatedAt: r.at === null ? null : new Date(r.at).toISOString(), url: SOURCES[r.source].page }))
    return json({ from, to, dateTimezone: ET, events, sources, fetchedAt: new Date(now()).toISOString() }, results.length > 0 && results.every(r => r.state === 'unavailable') ? 503 : 200)
  }
}
