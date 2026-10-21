import { readFile, writeFile, rename } from 'node:fs/promises'
import { collectEconomicSnapshot, emptyEconomicSnapshot } from '../lib/economic-indicators.js'
const path = new URL('../data/economic-indicators.json', import.meta.url)
let previous
try { previous = JSON.parse(await readFile(path, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error; previous = emptyEconomicSnapshot() }
const snapshot = await collectEconomicSnapshot({ previous })
await writeFile(new URL('../data/economic-indicators.json.tmp', import.meta.url), JSON.stringify(snapshot, null, 2) + '\n')
await rename(new URL('../data/economic-indicators.json.tmp', import.meta.url), path)
for (const s of snapshot.series) console.log(`${s.id}: ${s.error ? 'collection failed; preserved previous data' : s.observations.length + ' observations'}; collected ${s.collectedAt || 'never'}`)
process.exitCode = snapshot.series.some(s => s.error) ? 1 : 0
