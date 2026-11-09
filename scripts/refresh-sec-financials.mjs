import { readFile, writeFile, rename } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createFinancialsHandler } from '../lib/stock-financials.js'
import { validFinancialRecord, SEC_TICKERS_URL, factsUrl } from '../lib/sec-financial-snapshot.js'

export async function collectFinancialSnapshot({ symbols, previous = null, handler = createFinancialsHandler(), now = Date.now } = {}) {
  if (!Array.isArray(symbols) || !symbols.length || symbols.length > 20 || new Set(symbols).size !== symbols.length || symbols.some(s => !/^[A-Z0-9][A-Z0-9.:-]{0,19}$/.test(s))) throw Error('invalid_financial_collection_symbols')
  const companies = {}, failures = []
  for (const symbol of symbols) {
    const old = previous?.version === 1 ? previous.companies?.[symbol] : null
    // Old records may be retained for audit but the runtime separately enforces
    // seven-day expiry. A failed collection never rewrites their fetchedAt.
    if (validFinancialRecord(old, symbol, now())) companies[symbol] = old
    try {
      const response = await handler(new Request(`https://example.com/api/stock-financials?ticker=${symbol}`))
      if (!response.ok) throw Error('collection_unavailable')
      const data = await response.json()
      const record = { ...data, tickerSource: SEC_TICKERS_URL, factsUrl: factsUrl(data.cik) }
      if (!validFinancialRecord(record, symbol, now())) throw Error('invalid_financial_record')
      companies[symbol] = record
    } catch {
      failures.push({ symbol, code: 'collection_failed' })
    }
  }
  return { version: 1, attemptedAt: new Date(now()).toISOString(), companies, failures }
}
async function main() {
  const config = JSON.parse(await readFile(new URL('../config/sec-financials.json', import.meta.url), 'utf8'))
  const destination = new URL('../data/sec-financials.json', import.meta.url)
  let previous
  try { previous = JSON.parse(await readFile(destination, 'utf8')) } catch { /* First verified collection. */ }
  const snapshot = await collectFinancialSnapshot({ symbols: config.symbols, previous })
  const temporary = new URL('../data/sec-financials.json.tmp', import.meta.url)
  await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n'); await rename(temporary, destination)
  console.log(`SEC financials: ${Object.keys(snapshot.companies).length} retained/verified records; ${snapshot.failures.length} failed collections.`)
  if (snapshot.failures.length) process.exitCode = 1
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
