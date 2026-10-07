import test from 'node:test'
import assert from 'node:assert/strict'
import { cachedSearch, searchStocks } from '../src/lib/stockSearch.ts'
const at = Date.parse('2026-10-07T05:00:00Z')
test('repeated searches reuse bounded results without case-dependent delays and eventually expire', async () => {
  const matches = await searchStocks('aapl', new AbortController().signal, async () => Response.json({results:[{ticker:'AAP',name:'Other'},{ticker:'AAPL',name:'Apple'},{ticker:'https://bad.test',name:'Bad'}]}), at)
  assert.equal(matches[0].ticker, 'AAPL')
  assert.equal(matches.length, 2)
  assert.deepEqual(cachedSearch(' AAPL ', at + 1), matches)
  assert.equal(cachedSearch('aapl', at + 15 * 60000), undefined)
})
test('cancelled and malformed search results are not cached as successful empty responses', async () => {
  await assert.rejects(searchStocks('cancelled', AbortSignal.abort(), async () => Response.json({results:[]}), at), {name:'AbortError'})
  assert.equal(cachedSearch('cancelled', at), undefined)
  await assert.rejects(searchStocks('malformed', new AbortController().signal, async () => Response.json({error:'failed'}), at))
  assert.equal(cachedSearch('malformed', at), undefined)
})
