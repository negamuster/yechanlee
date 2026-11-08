import test from 'node:test'
import assert from 'node:assert/strict'
import { editorialBatches, sameNewsEvent } from '../src/components/newsEditorial.ts'
import { classifyNews } from '../lib/news-topics.js'
import { filterNews } from '../src/components/newsSelection.ts'
const now = Date.parse('2026-11-08T12:00:00Z')
const item = (id, title, hours = 1, publisher = id) => ({ id, title, publisher, region: 'global', topics: ['investing'], article_url: `https://example.com/${id}`, published_utc: new Date(now - hours * 3600000).toISOString() })

test('routine stories are excluded at ingestion and in old browser snapshots; corporate impact survives', () => {
  for (const title of ['[표] 외국환율고시표', '[포토] 배추값 진정되나', '지석진, 처참한 주식 폭망…손실 상황 충격 (런닝맨)', '중기중앙회, 2027년 신입직원 26명 공모', '은행법학회 신임 회장에 송 변호사', '성공투자 원칙…특강에서 직접 들어보세요']) {
    assert.deepEqual(classifyNews(title, 'Finance Business'), [], title)
    assert.equal(filterNews([item('one', title)], 'all', 'all', '', now).length, 0)
  }
  for (const title of ['경제 주체들이 배우는 투자 전략', '신입사원 채용 감소, 고용시장 침체 신호', '배우 노조 파업에 영화사 주가 하락', '아이돌 소속사 지분 매각 추진', '축구 중계권 매출 급증', '배우 소속 상장기업 실적 악화 공시', '기업 구조조정 대규모 해고 발표', 'Fed holds interest rates']) assert.ok(classifyNews(title).length, title)
})
test('major prioritizes an economic release over fresh generic articles; latest is strictly chronological', () => {
  const data = [item('fresh', 'Technology market discussion', .1), item('cpi', 'US CPI inflation report released', 2)]
  assert.equal(editorialBatches(data, 'all', now, 'major')[0][0].id, 'cpi')
  assert.equal(editorialBatches(data, 'all', now, 'latest')[0][0].id, 'fresh')
  assert.equal(editorialBatches(data, 'all', now, 'major')[0][0].selectionReason, '통화정책·경제지표')
})
test('group only close lexical reports and preserve original metadata; latest exposes all original reports', () => {
  const a = item('a', 'Apple announces quarterly earnings revenue growth 10%', 1)
  const b = item('b', 'Apple quarterly earnings revenue growth 10% announced', 2)
  assert.ok(sameNewsEvent(a, b))
  const result = editorialBatches([b, a], 'all', now, 'major').flat()
  assert.equal(result.length, 1)
  assert.deepEqual(result[0].related, [b])
  assert.equal(result[0].published_utc, a.published_utc)
  assert.equal(a.related, undefined)
  assert.equal(editorialBatches([b, a], 'all', now, 'latest').flat().length, 2)
  for (const other of [item('c', b.title.replace('10%', '11%')), item('d', 'Updated: ' + b.title), item('e', b.title.replace('Apple', 'Microsoft')), item('f', b.title, 20), item('g', b.title.replace('growth', 'decline'))]) assert.equal(sameNewsEvent(a, other), false, other.title)
})
test('all eligible links remain reachable across batches, grouping is filter-scoped and deterministic', () => {
  assert.equal(sameNewsEvent(item('before', 'Apple shares rise before quarterly earnings report'), item('after', 'Apple shares rise after quarterly earnings report')), false)
  assert.equal(sameNewsEvent(item('buyer', 'Apple acquires Microsoft in major technology deal'), item('seller', 'Microsoft acquires Apple in major technology deal')), false)
  const data = Array.from({ length: 30 }, (_, i) => item(String(i), `Company${i} quarterly earnings report ${i}`, i / 2, i % 2 ? 'A' : 'B'))
  const result = editorialBatches(data, 'all', now, 'major').flat()
  assert.equal(result.length, 30)
  assert.deepEqual(result, editorialBatches([...data].reverse(), 'all', now, 'major').flat())
  assert.equal(editorialBatches(data, 'kr', now, 'major').length, 0)
  assert.equal(editorialBatches([item('old', 'Fed rate decision', 73), item('future', 'Fed rate decision', -1)], 'all', now, 'major').length, 0)
})
