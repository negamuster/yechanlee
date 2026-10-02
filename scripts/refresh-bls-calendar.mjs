import { mkdir, writeFile, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { SOURCES, readBLSSnapshot } from '../lib/calendar.js'

// Only a complete, validated official response replaces the last known schedule.
const response = await fetch(SOURCES.bls.url, {
  headers: { 'User-Agent': 'AnthraciteCalendar/1.0 (+https://github.com/negamuster/yechanlee)', Accept: 'text/calendar' },
  signal: AbortSignal.timeout(45000),
})
if (!response.ok) throw new Error(`BLS returned HTTP ${response.status}`)
const snapshot = { version: 1, sourceUrl: SOURCES.bls.url, checkedAt: new Date().toISOString(), ics: (await response.text()).replace(/^\uFEFF/, '') }
const { events } = readBLSSnapshot(snapshot)
const directory = new URL('../data/', import.meta.url)
await mkdir(directory, { recursive: true })
const destination = new URL('bls-calendar.json', directory)
const temporary = `${fileURLToPath(destination)}.tmp`
await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n')
await rename(temporary, destination)
console.log(`Saved ${events.length} official BLS releases, checked ${snapshot.checkedAt}`)
