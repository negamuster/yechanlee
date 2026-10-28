import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validMonitor, monitorIdentity } from '../lib/sec-monitor.js'
const real = JSON.parse(readFileSync(new URL('../public/data/sec-filings.json', import.meta.url)))
const fixture = JSON.parse(readFileSync(new URL('./fixtures/sec-monitor.json', import.meta.url)))
test('published EdgarTools snapshot matches configured CIK identities and safe source URLs', () => {
  assert.ok(validMonitor(real))
  const config = JSON.parse(readFileSync(new URL('../config/sec-monitor.json', import.meta.url)))
  assert.deepEqual(real.companies.map(monitorIdentity), config.companies)
  assert.deepEqual(real.universe, config.universe)
})
test('unsafe or mismatched metadata, future receipts and unordered accessions are rejected', () => {
  for (const mutate of [d => d.companies[0].filings[0].url = 'https://evil.test/', d => d.companies[0].cik = '0000000001', d => d.companies[0].filings[0].filed = '2026-02-30', d => d.companies[0].filings.push(d.companies[0].filings[0]), d => d.companies.push(d.companies[0]), d => d.companies[0].coverageTo = '2099-01-01']) {
    const d = structuredClone(fixture); mutate(d); assert.equal(validMonitor(d), false)
  }
  assert.equal(validMonitor(real, 1), false)
})
test('unavailable is distinct from confirmed empty, and stale preserves its earlier receipt', () => {
  const d = structuredClone(fixture), c = d.companies[0]
  c.filings = []; assert.ok(validMonitor(d))
  c.status = 'unavailable'; assert.equal(validMonitor(d), false)
  c.fetchedAt = c.coverageFrom = c.coverageTo = null; assert.ok(validMonitor(d))
  c.status = 'stale'; assert.equal(validMonitor(d), false)
})
test('index universe rejects missing coverage, duplicate issuer and ambiguous share aliases', () => {
  assert.ok(real.universe)
  assert.equal(real.companies.filter(c => c.indices.includes('sp500')).length, 500)
  assert.equal(real.companies.filter(c => c.indices.includes('nasdaq100')).length, 100)
  assert.deepEqual(real.companies.find(c => c.symbol === 'GOOGL').aliases, ['GOOG', 'GOOGL'])
  for (const mutate of [d => d.companies.pop(), d => d.companies[1].cik = d.companies[0].cik, d => d.companies[1].aliases.push(d.companies[0].symbol), d => d.universe.checkedAt = '2099-01-01T00:00:00Z']) {
    const d = structuredClone(real); mutate(d); assert.equal(validMonitor(d), false)
  }
})
