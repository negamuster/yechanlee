import test from 'node:test'
import assert from 'node:assert/strict'
import { collect13F, create13FHandler } from '../lib/form13f.js'

function fixture({ corruptPrevious = false } = {}) {
  const calls = []
  const positions = {
    '2026-06-30': Array.from({ length: 67 }, (_, i) => ({ cusip: String(i + 1).padStart(9, '0'), title: 'COM', shares: i + 10, value: i + 1 })),
    '2026-03-31': [{ cusip: '000000001', title: 'COMMON STOCK', shares: 20, value: 20 }, { cusip: '999999999', title: 'COM', shares: 8, value: 80 }],
  }
  const periods = Object.keys(positions), accessions = ['0000000001-26-000001', '0000000001-26-000002']
  return { calls, fetchImpl: async url => {
    calls.push(url)
    if (url.includes('/submissions/')) return Response.json({ name: 'Test manager', filings: { recent: { form: periods.map(() => '13F-HR'), reportDate: periods, filingDate: ['2026-08-14', '2026-05-15'], accessionNumber: accessions, primaryDocument: periods.map(() => 'primary.xml') } } })
    const i = accessions.findIndex(a => url.includes(a.replaceAll('-', '')))
    assert.ok(i >= 0, url)
    const period = periods[i], rows = positions[period]
    if (url.endsWith('index.htm')) return new Response('<tr><td>INFORMATION TABLE</td><td><a href="table.xml">table</a></td></tr>')
    if (url.endsWith('primary.xml')) return new Response(`<edgarSubmission><formData><coverPage><reportCalendarOrQuarter>${period}</reportCalendarOrQuarter></coverPage><summaryPage><tableEntryTotal>${rows.length + (corruptPrevious && i === 1 ? 1 : 0)}</tableEntryTotal><tableValueTotal>${rows.reduce((s, h) => s + h.value, 0)}</tableValueTotal></summaryPage></formData></edgarSubmission>`)
    return new Response(`<informationTable>${rows.map(h => `<infoTable><nameOfIssuer>Issuer ${h.cusip}</nameOfIssuer><titleOfClass>${h.title}</titleOfClass><cusip>${h.cusip}</cusip><value>${h.value}</value><shrsOrPrnAmt><sshPrnamt>${h.shares}</sshPrnamt><sshPrnamtType>SH</sshPrnamtType></shrsOrPrnAmt></infoTable>`).join('')}</informationTable>`)
  } }
}
test('full collection exceeds 30 rows and identifies previous-only holdings by CUSIP despite title variations', async () => {
  const data = await collect13F('0001067983', fixture())
  assert.equal(data.holdings.length, 67); assert.equal(data.holdingCount, 67); assert.equal(data.holdingsComplete, true)
  assert.equal(data.totalValue, data.holdings.reduce((s, h) => s + h.value, 0))
  assert.equal(data.holdings.find(h => h.cusip === '000000001').prevShares, 20)
  assert.equal(data.holdings.find(h => h.cusip === '000000002').prevShares, 0)
  assert.deepEqual(data.closedHoldings.map(h => [h.cusip, h.shares, h.prevShares, h.value]), [['999999999', 0, 8, 0]])
  assert.equal(data.previousSources.length, 1)
})
test('invalid previous data is unknown and never manufactures new positions or exits', async () => {
  const data = await collect13F('0001067983', fixture({ corruptPrevious: true }))
  assert.equal(data.previousAvailable, false); assert.deepEqual(data.closedHoldings, [])
  assert.ok(data.holdings.every(h => h.prevShares === undefined))
})
test('explicit quarters have separate caches and missing quarters never fall back to latest', async () => {
  const f = fixture(), handler = create13FHandler(f)
  const request = period => new Request(`https://example.test/api/form13f?cik=0001067983${period ? `&period=${period}` : ''}`)
  const latest = await (await handler(request())).json(), previous = await (await handler(request('2026-03-31'))).json()
  assert.equal(latest.period, '2026-06-30'); assert.equal(previous.period, '2026-03-31'); assert.equal(previous.holdings.length, 2)
  const count = f.calls.length
  assert.equal((await (await handler(request())).json()).period, latest.period)
  assert.equal((await (await handler(request('2026-03-31'))).json()).period, previous.period)
  assert.equal(f.calls.length, count)
  assert.equal((await handler(request('2026-09-30'))).status, 404)
  const beforeInvalid = f.calls.length
  for (const p of ['2026-06-31', '2026-01-01', 'arbitrary', '../../']) assert.equal((await handler(request(p))).status, 400)
  assert.equal(f.calls.length, beforeInvalid)
})
