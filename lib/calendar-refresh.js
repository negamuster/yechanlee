import { SOURCES, readBLSSnapshot, dateInNY, addDays } from './calendar.js'
import { FRED_RELEASES, FRED_URL, parseFREDCalendar, readFREDSnapshot } from './fred-calendar.js'
import { blsScheduleUrl, parseBLSSchedule } from './bls-schedule.js'

// Each provider owns its file and original verification time. A successful BLS
// download must not prevent FRED from refreshing its independent fallback.
export async function refreshCalendarSnapshots({ download, save, now = Date.now, log = console }) {
  const results = {}
  try {
    let ics, schedule
    try {
      ics = await download(SOURCES.bls.url)
      readBLSSnapshot({ version: 1, sourceUrl: SOURCES.bls.url, checkedAt: new Date(now()).toISOString(), ics }, now())
    } catch (error) { ics = undefined; log.warn(`BLS ICS unavailable (${error.message}); checking official annual schedule.`) }
    try { const year = Number(dateInNY(now()).slice(0, 4)); schedule = parseBLSSchedule(await download(blsScheduleUrl(year)), year) }
    catch (error) { if (!ics) throw error; log.warn(`BLS selected-release supplement unavailable (${error.message}); coverage may be incomplete.`) }
    const snapshot = { version: 1, sourceUrl: ics ? SOURCES.bls.url : schedule.sourceUrl, checkedAt: new Date(now()).toISOString(), ...(ics ? { ics } : {}), ...(schedule ? { schedule } : {}) }
    const { events } = readBLSSnapshot(snapshot, now())
    await save('bls-calendar.json', snapshot)
    results.bls = { status: 'ok', events: events.length }
    log.log(`Saved ${events.length} official BLS releases, checked ${snapshot.checkedAt}`)
  } catch (error) { results.bls = { status: 'unavailable' }; log.warn(`BLS collection failed (${error.message}); preserving previous BLS file/time.`) }
  try {
    const today = dateInNY(now()), from = addDays(today, -70), to = addDays(today, 130), events = []
    for (const rid of Object.keys(FRED_RELEASES)) {
      const rows = parseFREDCalendar(await download(`${FRED_URL}?rid=${rid}&vs=${from}&ve=${to}`), rid)
      events.push(...rows)
    }
    const snapshot = { version: 1, sourceUrl: FRED_URL, checkedAt: new Date(now()).toISOString(), from, to, releaseIds: Object.keys(FRED_RELEASES).map(Number), events }
    readFREDSnapshot(snapshot, now())
    await save('fred-bls-calendar.json', snapshot)
    results.fred = { status: 'ok', events: events.length }
    log.log(`Saved ${events.length} FRED BLS release dates; only ${snapshot.releaseIds.length} families are covered.`)
  } catch (error) { results.fred = { status: 'unavailable' }; log.warn(`FRED collection failed (${error.message}); preserving previous FRED file/time.`) }
  if (Object.values(results).every(result => result.status !== 'ok')) throw new Error('all_calendar_refresh_sources_failed')
  return results
}
