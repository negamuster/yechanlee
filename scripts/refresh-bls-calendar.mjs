import { mkdir, writeFile, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { refreshCalendarSnapshots } from '../lib/calendar-refresh.js'
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
await refreshCalendarSnapshots({ download, save })
