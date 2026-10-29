import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { inspectHealth } from '../lib/data-health.js'
import { PRODUCTION_ORIGIN as origin, runStockHealth, healthSymbol, HEALTH_SYMBOLS } from '../lib/stock-health.js'
const args = process.argv.slice(2), symbolIndex = args.indexOf('--symbol')
const symbol = symbolIndex < 0 ? healthSymbol() : args[symbolIndex + 1]
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--stocks-only') continue
  if (args[index] === '--symbol' && HEALTH_SYMBOLS.includes(args[++index])) continue
  throw new Error('Usage: node scripts/check-data-health.mjs [--stocks-only] [--symbol AAPL|NVDA|SATL]')
}
const checks = [['indicators', '/api/economic-indicators'], ['news', '/api/news'], ['indices', '/api/market-indices'], ['movers', '/api/market-movers'], ['maps', '/api/sector-performance'], ['company-map', '/api/sector-performance?view=companies'], ['calendar', '/api/calendar?mode=month']]
const lines = ['# Production data health', '', `Checked: ${new Date().toISOString()}`, '', '| Feed | Result | Detail |', '| --- | --- | --- |']
let failed = false
const report = { checkedAt: Date.now(), symbol, checks: [] }
function record(result) {
  report.checks.push(result); failed ||= result.status === 'FAIL'
  const detail = [...result.errors, ...result.warnings].join('; ') || 'Data available'
  lines.push(`| ${result.name} | ${result.status} | ${detail} |`)
  console.log(`${result.status} ${result.name}: ${detail}`)
  if (process.env.GITHUB_ACTIONS && ['FAIL', 'WARN'].includes(result.status)) console.log(`::${result.status === 'FAIL' ? 'error' : 'warning'} title=${result.name} data health::${detail}`)
}
for (const [name, path] of args.includes('--stocks-only') ? [] : checks) {
  let result
  try {
    const response = await fetch(origin + path, { signal: AbortSignal.timeout(55000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    result = inspectHealth(name, await response.json())
  } catch (error) { result = { errors: [error.message], warnings: [] } }
  const status = result.errors.length ? 'FAIL' : result.warnings.length ? 'WARN' : 'OK'
  record({ name, status, ...result })
}
await runStockHealth({ symbol, onResult: record })
mkdirSync('reports', { recursive: true })
writeFileSync('reports/data-health.json', JSON.stringify(report, null, 2) + '\n')
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n')
process.exitCode = failed ? 1 : 0
