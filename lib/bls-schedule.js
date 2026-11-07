import { load } from 'cheerio'
import { dateInNY, validDate, zonedISO } from './calendar.js'

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const holidays = new Set(["New Year's Day", 'Birthday of Martin Luther King, Jr.', "Washington's Birthday", 'Memorial Day', 'Juneteenth National Independence Day', 'Independence Day', 'Labor Day', 'Columbus Day', 'Veterans Day', 'Thanksgiving Day', 'Christmas Day'])
export const blsScheduleUrl = year => `https://www.bls.gov/schedule/${year}/`
export const blsReleaseKey = title => title.replace(/\s*\((?:P|R)\)\s*/g, '').trim()

export function readBLSSchedule(schedule) {
  if (!Number.isInteger(schedule?.year) || schedule.year < 2000 || schedule.year > 2100
    || schedule.sourceUrl !== blsScheduleUrl(schedule.year)
    || !Array.isArray(schedule.events) || !schedule.events.length || schedule.events.length > 1000) throw new Error('invalid_bls_schedule')
  const keys = new Set()
  return schedule.events.map(event => {
    const timestamp = Date.parse(event.startAt)
    if (typeof event.title !== 'string' || !event.title.trim() || event.title.length > 300
      || !validDate(event.date) || !event.date.startsWith(`${schedule.year}-`)
      || typeof event.startAt !== 'string' || !Number.isFinite(timestamp)
      || new Date(timestamp).toISOString() !== event.startAt
      || dateInNY(timestamp) !== event.date) throw new Error('invalid_bls_schedule_event')
    const key = `${blsReleaseKey(event.title)}:${event.date}`
    if (keys.has(key)) throw new Error('duplicate_bls_schedule_event')
    keys.add(key)
    return { id: `bls-schedule:${key}`, title: event.title, date: event.date, startAt: event.startAt, category: 'Economic', session: null, major: /Consumer Price Index|Producer Price Index|Employment Situation|Job Openings/.test(event.title), source: 'BLS', sourceUrl: schedule.sourceUrl, estimated: false }
  })
}

export function parseBLSSchedule(html, year) {
  const $ = load(html)
  if (!html.includes('</html>') || !$('body').text().includes('All times on calendar are Eastern Time.') || $('table.release-list').length !== 12) throw new Error('incomplete_bls_schedule')
  const events = []
  $('table.release-list tbody tr').each((_, row) => {
    const cells = $(row)
    const dateText = cells.find('.date-cell').text().trim()
    const match = dateText.match(/^[A-Za-z]+, ([A-Za-z]+) (\d{1,2}), (\d{4})$/)
    const title = cells.find('.desc-cell strong').text().trim()
    const timeText = cells.find('.time-cell').text().trim()
    if (!match || Number(match[3]) !== year || !months.includes(match[1]) || !title) throw new Error('invalid_bls_schedule_row')
    if (!timeText && holidays.has(title)) return
    const time = timeText.match(/^(0?[1-9]|1[0-2]):([0-5]\d) (AM|PM)$/)
    if (!time) throw new Error('invalid_bls_schedule_time')
    const date = `${year}-${String(months.indexOf(match[1]) + 1).padStart(2, '0')}-${match[2].padStart(2, '0')}`
    if (!validDate(date)) throw new Error('invalid_bls_schedule_date')
    events.push({ title, date, startAt: zonedISO(date, Number(time[1]) % 12 + (time[3] === 'PM' ? 12 : 0), Number(time[2])) })
  })
  const schedule = { year, sourceUrl: blsScheduleUrl(year), events }
  readBLSSchedule(schedule)
  return schedule
}
