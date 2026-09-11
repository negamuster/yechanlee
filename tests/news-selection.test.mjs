import test from 'node:test'
import assert from 'node:assert/strict'
import { selectNews } from '../src/components/newsSelection.ts'
const now = Date.parse('2026-09-11T12:00:00Z')
const item = (publisher, region, minutes) => ({ id: `${publisher}-${minutes}`, title: 'Headline', article_url: 'https://example.com/article', published_utc: new Date(now - minutes * 60000).toISOString(), publisher, region })

test('a prolific publisher cannot fill slots before other publishers get one', () => {
  const data = [item('A','kr',1), item('A','kr',2), item('A','kr',3), item('B','kr',4), item('C','kr',5)]
  const selected = selectNews(data,'kr',now,3)
  assert.deepEqual(new Set(selected.map(x=>x.publisher)), new Set(['A','B','C']))
})
test('combined view includes both regions and fills unused region slots', () => {
  const data = [...Array.from({length:7},(_,i)=>item(`Global${i}`,'global',i+1)), ...Array.from({length:5},(_,i)=>item(`Korea${i}`,'kr',i+1))]
  assert.equal(new Set(selectNews(data,'all',now).map(x=>x.publisher)).size,12)
  assert.equal(selectNews(data,'global',now).length,7)
  assert.equal(selectNews(data,'kr',now).length,5)
})
test('stale and future headlines are excluded and each publisher is capped at three', () => {
  const data = Array.from({length:8},(_,i)=>item('A','kr',i+1))
  data.push(item('Old','kr',5000),item('Future','kr',-60))
  assert.equal(selectNews(data,'all',now).length,3)
})
