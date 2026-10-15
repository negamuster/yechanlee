import type { CalendarData, CalendarEvent } from './calendarPresentation.ts'

export const CALENDAR_PREVIEW_LIMIT = 5
export type CalendarTimezone = 'Asia/Seoul' | 'America/New_York'
const dateInNY = (now: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
function validUrl(value: unknown) {
  if (typeof value !== 'string') return false
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
}
const validTime = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
export function validCalendarPreview(value: unknown): value is CalendarData {
  if (!value || typeof value !== 'object') return false
  const data = value as CalendarData
  return validTime(data.fetchedAt) && Array.isArray(data.events) && Array.isArray(data.sources)
    && data.events.every(event => event && typeof event.id === 'string' && typeof event.title === 'string'
      && ['Economic', 'Earnings', 'Fed', 'Events'].includes(event.category) && validDate(event.date)
      && (event.startAt === null || validTime(event.startAt)) && [null, 'pre', 'post', 'unknown'].includes(event.session)
      && typeof event.major === 'boolean' && typeof event.estimated === 'boolean'
      && typeof event.source === 'string' && validUrl(event.sourceUrl) && (event.ticker === undefined || typeof event.ticker === 'string'))
    && data.sources.every(source => source && typeof source.name === 'string' && validUrl(source.url)
      && (source.date === null || validDate(source.date)) && (source.updatedAt === null || validTime(source.updatedAt))
      && ['ok', 'snapshot', 'stale', 'unavailable'].includes(source.state))
}
export function calendarPreviewRange(now: number) {
  const from = dateInNY(now)
  const to = new Date(Date.parse(`${from}T12:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10)
  return { from, to }
}
export function calendarPreviewRequest(now: number, includeEarnings: boolean) {
  const { from, to } = calendarPreviewRange(now)
  // One combined request only fetches earnings when saved stocks make them relevant.
  return `/api/calendar?from=${from}&to=${to}&mode=${includeEarnings ? 'all' : 'month'}`
}
export function selectUpcomingCalendar(events: CalendarEvent[], now: number, watched: Set<string>) {
  const { from, to } = calendarPreviewRange(now)
  const tickers = new Set([...watched].map(ticker => ticker.toUpperCase()))
  const seen = new Set<string>()
  const selected = events.filter(event => {
    if (seen.has(event.id) || event.date < from || event.date > to) return false
    if (!event.major && !(event.category === 'Earnings' && event.ticker && tickers.has(event.ticker.toUpperCase()))) return false
    // Date-only events retain an explicit unknown time; no release time is invented.
    if (event.startAt !== null && (!Number.isFinite(Date.parse(event.startAt)) || Date.parse(event.startAt) < now)) return false
    seen.add(event.id)
    return true
  }).sort((a, b) => {
    const day = a.date.localeCompare(b.date)
    if (day) return day
    if (a.startAt && b.startAt) return Date.parse(a.startAt) - Date.parse(b.startAt) || a.id.localeCompare(b.id)
    if (a.startAt || b.startAt) return a.startAt ? -1 : 1
    const order = (event: CalendarEvent) => event.session === 'pre' ? 0 : event.session === 'post' ? 1 : 2
    return order(a) - order(b) || a.id.localeCompare(b.id)
  })
  return { events: selected.slice(0, CALENDAR_PREVIEW_LIMIT), total: selected.length }
}
export function calendarPreviewTime(event: CalendarEvent, timezone: CalendarTimezone) {
  if (!event.startAt) return {
    date: `${event.date.slice(5).replace('-', '.')} ET`,
    time: event.session === 'pre' ? '장전' : event.session === 'post' ? '장후' : '미정',
    description: `${event.date} 미국 날짜 · ${event.session === 'pre' ? '장전 · 정확한 시각 미정' : event.session === 'post' ? '장후 · 정확한 시각 미정' : '발표 시각 미정'}`,
  }
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(event.startAt)).map(part => [part.type, part.value]))
  const zone = timezone === 'Asia/Seoul' ? 'KST' : 'ET'
  return { date: `${parts.month}.${parts.day}`, time: `${parts.hour}:${parts.minute}`, description: `${parts.month}.${parts.day} ${parts.hour}:${parts.minute} ${zone}` }
}
export function calendarPreviewHealth(data: CalendarData | null, failed: boolean) {
  if (failed) return data ? '갱신 실패 · 이전 일정 표시' : '일정을 불러오지 못했습니다.'
  const stale = data?.sources.some(source => source.state === 'stale')
  const unavailable = data?.sources.some(source => source.state === 'unavailable')
  if (stale && unavailable) return '이전 자료 포함 · 일부 출처 확인 불가'
  if (unavailable) return '일부 출처 확인 불가'
  if (stale) return '일부 이전 자료 포함'
  if (data?.sources.some(source => source.state === 'snapshot')) return '저장 일정 포함'
  return null
}
