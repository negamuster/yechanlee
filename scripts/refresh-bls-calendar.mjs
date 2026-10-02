import { mkdir, writeFile, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { SOURCES, readBLSSnapshot, dateInNY, addDays } from '../lib/calendar.js'
import { FRED_RELEASES, FRED_URL, parseFREDCalendar, readFREDSnapshot } from '../lib/fred-calendar.js'
const headers = { 'User-Agent': 'AnthraciteCalendar/1.0 (+https://github.com/negamuster/yechanlee)' }
async function download(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.text()).replace(/^\uFEFF/, '')
}
async function save(name, snapshot) {
  const directory = new URL('../data/', import.meta.url)
  await mkdir(directory, { recursive: true })
  const destination = new URL(name, directory), temporary = `${fileURLToPath(destination)}.tmp`
  await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n')
  await rename(temporary, destination)
}
try {
  const ics = await download(SOURCES.bls.url)
  const snapshot = { version: 1, sourceUrl: SOURCES.bls.url, checkedAt: new Date().toISOString(), ics }
  const { events } = readBLSSnapshot(snapshot)
  await save('bls-calendar.json', snapshot)
  console.log(`Saved ${events.length} official BLS releases, checked ${snapshot.checkedAt}`)
} catch (error) {
  console.warn(`BLS direct collection unavailable (${error.message}); checking public FRED release calendars.`)
  const today = dateInNY(Date.now()), from = addDays(today, -70), to = addDays(today, 130)
  const events = []
  // Sequential, one request per release; all pages must validate before replacing a snapshot.
  for (const rid of Object.keys(FRED_RELEASES)) {
    const url = `${FRED_URL}?rid=${rid}&vs=${from}&ve=${to}`
    const rows = parseFREDCalendar(await download(url), rid)
    events.push(...rows)
    console.log(`FRED ${FRED_RELEASES[rid]}: ${rows.length} releases`)
  }
  const snapshot = { version: 1, sourceUrl: FRED_URL, checkedAt: new Date().toISOString(), from, to, releaseIds: Object.keys(FRED_RELEASES).map(Number), events }
  readFREDSnapshot(snapshot)
  await save('fred-bls-calendar.json', snapshot)
  console.log(`Saved ${events.length} BLS release dates from FRED; direct BLS snapshot was not modified.`)
}
