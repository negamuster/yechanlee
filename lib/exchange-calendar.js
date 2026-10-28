import snapshot from '../data/us-equity-sessions.json' with { type: 'json' }
import review from '../config/us-equity-calendar-review.json' with { type: 'json' }
import { nyDate } from './trading-session.js'

const DAY = 86400000
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const localTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' })
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const weekday = date => ![0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay())

// Validate complete reviewed weekday coverage, rather than trusting an absent row as a holiday.
export function validateExchangeCalendar(value, expected = review) {
  if (!value || value.version !== 1 || value.calendar !== 'XNYS' || value.timezone !== 'America/New_York'
    || value.from !== expected.from || value.to !== expected.to || !validDate(value.from) || !validDate(value.to)
    || value.from > value.to || value.reviewedAt !== expected.reviewedAt || !Number.isFinite(Date.parse(value.reviewedAt))
    || !Number.isFinite(Date.parse(value.generatedAt)) || !same(value.officialSources, expected.sources)
    || value.package?.name !== 'exchange_calendars' || value.package.version !== '4.13.2'
    || value.package.url !== 'https://github.com/gerrymanoim/exchange_calendars'
    || !same(value.holidays, [...expected.holidays].sort()) || !Array.isArray(value.sessions)) return false
  const holidays = new Set(expected.holidays), early = new Set(expected.earlyCloses), sessions = new Map()
  if (holidays.size !== expected.holidays.length || early.size !== expected.earlyCloses.length) return false
  for (const row of value.sessions) {
    if (!row || !validDate(row.date) || row.date < value.from || row.date > value.to || !weekday(row.date)
      || holidays.has(row.date) || sessions.has(row.date) || (sessions.size && row.date <= value.sessions[sessions.size - 1].date)
      || typeof row.open !== 'string' || typeof row.close !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/.test(row.open) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/.test(row.close)
      || !Number.isFinite(Date.parse(row.open)) || !Number.isFinite(Date.parse(row.close))
      || nyDate(Date.parse(row.open)) !== row.date || nyDate(Date.parse(row.close)) !== row.date
      || localTime.format(new Date(row.open)) !== '09:30:00'
      || localTime.format(new Date(row.close)) !== (early.has(row.date) ? '13:00:00' : '16:00:00')
      || row.earlyClose !== early.has(row.date)) return false
    sessions.set(row.date, row)
  }
  for (let time = Date.parse(value.from); time <= Date.parse(value.to); time += DAY) {
    const date = new Date(time).toISOString().slice(0, 10)
    if (weekday(date) && sessions.has(date) === holidays.has(date)) return false
  }
  return [...holidays, ...early].every(date => validDate(date) && date >= value.from && date <= value.to && weekday(date))
}

export function createExchangeCalendar(value, expected = review) {
  const valid = validateExchangeCalendar(value, expected)
  const rows = valid ? value.sessions.map(row => Object.freeze({ ...row })) : []
  const byDate = new Map(rows.map(row => [row.date, row]))
  const info = valid ? Object.freeze({ calendar: 'XNYS', timezone: value.timezone, from: value.from, to: value.to,
    reviewedAt: value.reviewedAt, generatedAt: value.generatedAt, packageVersion: value.package.version,
    url: 'https://www.nyse.com/markets/hours-calendars' }) : null
  const covers = date => !!info && validDate(date) && date >= info.from && date <= info.to
  function day(date) {
    if (!covers(date)) return { date, state: 'unavailable' }
    const session = byDate.get(date)
    return session ? { ...session, state: 'session' } : { date, state: weekday(date) ? 'holiday' : 'weekend' }
  }
  function status(now = Date.now()) {
    if (!Number.isFinite(now)) return { state: 'unavailable', session: null, nextSession: null }
    const current = day(nyDate(now))
    if (current.state === 'unavailable') return { state: 'unavailable', session: null, nextSession: null }
    const nextSession = rows.find(row => Date.parse(row.open) > now) ?? null
    if (current.state !== 'session') return { state: current.state, session: null, nextSession }
    const state = now < Date.parse(current.open) ? 'before-open' : now < Date.parse(current.close) ? 'open' : 'after-close'
    return { state, session: current, nextSession }
  }
  function datesThrough(date, lookbackDays = 14) {
    if (!covers(date) || !Number.isInteger(lookbackDays) || lookbackDays < 1 || lookbackDays > 366) return []
    const start = new Date(Date.parse(date) - (lookbackDays - 1) * DAY).toISOString().slice(0, 10)
    return rows.filter(row => row.date >= start && row.date <= date).map(row => row.date).reverse()
  }
  function events(from, to) {
    if (!covers(from) || !covers(to) || from > to || Date.parse(to) - Date.parse(from) > 366 * DAY) return null
    const result = []
    for (let time = Date.parse(from); time <= Date.parse(to); time += DAY) {
      const date = new Date(time).toISOString().slice(0, 10), current = day(date)
      if (current.state !== 'holiday' && !current.earlyClose) continue
      const allDay = current.state === 'holiday'
      result.push({ id: `xnys:${date}:${allDay ? 'holiday' : 'early-close'}`, date, category: 'Market',
        title: allDay ? 'NYSE equity market holiday' : 'NYSE equity market early close',
        startAt: allDay ? null : current.close, allDay, session: null, major: false, estimated: false,
        source: 'NYSE 일정 · exchange_calendars', sourceUrl: info.url,
        description: 'NYSE 현물 주식 정규장 예정 일정입니다. 임시 휴장·거래 중단·장외 시간은 포함하지 않습니다. 공식 공지에서 변경 여부를 확인하세요.' })
    }
    return result
  }
  return Object.freeze({ info, day, status, datesThrough, events })
}

export const exchangeCalendar = createExchangeCalendar(snapshot)
