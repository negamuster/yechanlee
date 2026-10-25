import { readFile, writeFile, rename, appendFile } from 'node:fs/promises'
import { collectEconomicSnapshot, emptyEconomicSnapshot } from '../lib/economic-indicators.js'
import { economicCollectionReport } from '../lib/economic-collection-report.js'
const path = new URL('../data/economic-indicators.json', import.meta.url)
let previous
try { previous = JSON.parse(await readFile(path, 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error; previous = emptyEconomicSnapshot() }
const snapshot = await collectEconomicSnapshot({ previous })
const report = economicCollectionReport(snapshot)
await writeFile(new URL('../data/economic-indicators.json.tmp', import.meta.url), JSON.stringify(snapshot, null, 2) + '\n')
await rename(new URL('../data/economic-indicators.json.tmp', import.meta.url), path)
for (const line of report.lines) console.log(line)
for (const warning of report.warnings) console.warn(process.env.GITHUB_ACTIONS === 'true' ? `::warning title=Economic source fallback::${warning}` : `WARN ${warning}`)
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report.summary)
process.exitCode = report.exitCode
