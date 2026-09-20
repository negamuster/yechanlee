import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../src/pages/Form13F.tsx', import.meta.url), 'utf8')
const fn = source.slice(source.indexOf('async function fetchLatest13F'), source.indexOf('export default function Form13F'))
const js = ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
function make({ reportDate = ['2026-06-30', '2026-03-31'], previousFails = false } = {}) {
  const fetch = async () => ({ ok: true, json: async () => ({ filings: { recent: { form: ['13F-HR', '13F-HR'], reportDate, filingDate: ['2026-08-14', '2026-05-15'], accessionNumber: ['current', 'previous'], primaryDocument: ['a', 'b'] } } }) })
  const fetchFiling = async (_, acc) => {
    if (acc === 'previous' && previousFails) throw new Error('unavailable')
    return new Map([[acc === 'previous' ? 'Old' : 'New', { name: acc === 'previous' ? 'Old' : 'New', value: 100, shares: 10 }]])
  }
  return new Function('fetch', 'fetchFiling', 'proxy', js + '; return fetchLatest13F')(fetch, fetchFiling, x => x)
}
test('13F keeps report date and filing date distinct, including missing report date', async () => {
  const d = await make()('1')
  assert.equal(d.period, '2026-06-30'); assert.equal(d.filedAt, '2026-08-14')
  assert.equal((await make({ reportDate: [] })('1')).period, '')
})
test('failed prior filing is unknown rather than a new holding', async () => {
  assert.equal((await make({ previousFails: true })('1')).holdings[0].prevShares, undefined)
  assert.equal((await make()('1')).holdings[0].prevShares, 0)
})
