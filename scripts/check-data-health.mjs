import { appendFileSync } from 'node:fs'
import { inspectHealth } from '../lib/data-health.js'
const origin = 'https://yechanlee.vercel.app'
const checks = [['news', '/api/news'], ['indices', '/api/market-indices'], ['movers', '/api/market-movers'], ['maps', '/api/sector-performance'], ['calendar', '/api/calendar?mode=month']]
const lines = ['# Production data health', '', `Checked: ${new Date().toISOString()}`, '', '| Feed | Result | Detail |', '| --- | --- | --- |']
let failed = false
for (const [name, path] of checks) {
  let result
  try {
    const response = await fetch(origin + path, { signal: AbortSignal.timeout(55000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    result = inspectHealth(name, await response.json())
  } catch (error) { result = { errors: [error.message], warnings: [] } }
  const status = result.errors.length ? 'FAIL' : result.warnings.length ? 'WARN' : 'OK'
  failed ||= !!result.errors.length
  const detail = [...result.errors, ...result.warnings].join('; ') || 'Data available'
  lines.push(`| ${name} | ${status} | ${detail} |`)
  console.log(`${status} ${name}: ${detail}`)
  if (process.env.GITHUB_ACTIONS && status !== 'OK') console.log(`::${status === 'FAIL' ? 'error' : 'warning'} title=${name} data health::${detail}`)
}
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n')
process.exitCode = failed ? 1 : 0
