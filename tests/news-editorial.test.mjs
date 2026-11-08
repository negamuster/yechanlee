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
  assert.equal(editorialBatches(data, 'all', now, 'major')[0][0].selectionReason, '물가·경제지표')
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
  assert.equal(sameNewsEvent(item('repeat-a', 'Apple sells Microsoft shares to Apple investors'), item('repeat-b', 'Apple sells Microsoft shares to Microsoft investors')), false)
  const data = Array.from({ length: 30 }, (_, i) => item(String(i), `Company${i} quarterly earnings report ${i}`, i / 2, i % 2 ? 'A' : 'B'))
  const result = editorialBatches(data, 'all', now, 'major').flat()
  assert.equal(result.length, 30)
  assert.deepEqual(result, editorialBatches([...data].reverse(), 'all', now, 'major').flat())
  assert.equal(editorialBatches(data, 'kr', now, 'major').length, 0)
  assert.equal(editorialBatches([item('old', 'Fed rate decision', 73), item('future', 'Fed rate decision', -1)], 'all', now, 'major').length, 0)
})

test('topic diversity reduces macro repetition without losing originals, reports outrank same-age previews', async () => {
  const { articleKind, newsPriority } = await import('../src/components/newsEditorial.ts')
  assert.equal(articleKind('Why interest rates matter'), '해설·의견')
  assert.equal(articleKind('[뉴욕채권-주간] CPI 발표 주목'), '전망·예고')
  assert.equal(articleKind('Nvidia earnings beat estimates'), '보도·일반')
  for (const title of ['UPS 연간 실적 전망 상향', 'Company raises earnings outlook', 'Boeing withdraws annual guidance']) assert.equal(articleKind(title), '보도·일반')
  assert.equal(articleKind('Analysts expect Company could raise earnings outlook'), '전망·예고')
  const data = [...Array.from({ length: 12 }, (_, i) => item(`macro${i}`, `CPI inflation outlook issue ${i}`, 1, `Macro${i}`)), ...Array.from({ length: 6 }, (_, i) => item(`corp${i}`, `Company${i} earnings beat estimates`, 1, `Corp${i}`))]
  const first = editorialBatches(data, 'all', now, 'major')[0]
  assert.ok(first.filter(x => x.id.startsWith('corp')).length >= 3)
  assert.equal(editorialBatches(data, 'all', now, 'major').flat().length, 18)
  assert.ok(newsPriority(item('new', 'Fed holds interest rates at 5%', 1), now).score > newsPriority(item('old', 'Fed holds interest rates at 5%', 60), now).score)
})
test('explicit same-day bank decisions can group across languages; forecasts, reactions and changed facts cannot', () => {
  const decision = item('en', 'Fed holds interest rates at 5.25%')
  const equivalent = item('ko', '연준 기준금리 5.25% 동결', 2)
  assert.equal(sameNewsEvent(decision, equivalent), true)
  for (const title of ['ECB holds interest rates at 5.25%', 'Fed cuts interest rates to 5.25%', '연준 기준금리 5.5% 동결', 'Fed may hold interest rates at 5.25%', 'Fed official calls for holding interest rates at 5.25%', 'Fed refuses to hold interest rates at 5.25%', 'Stocks rise after Fed holds interest rates at 5.25%', '연준 기준금리 5.25% 동결 전망', 'Fed holds interest rates at 5.25%, changes QT policy']) assert.equal(sameNewsEvent(decision, item('other', title)), false, title)
  assert.equal(sameNewsEvent(item('cut-en', 'Fed cuts rates to 5%'), item('cut-ko', '연준 금리 5% 인하')), false)
  assert.equal(sameNewsEvent(item('cut-en', 'Fed cuts rates to 5%'), item('cut-at', 'Fed cuts rates at 5%')), false)
  assert.equal(sameNewsEvent(item('cut-en', 'Fed cuts rates to 5%'), item('cut-target', '연준 금리 5%로 인하')), true)
  assert.equal(sameNewsEvent(decision, { ...equivalent, published_utc: '2026-11-07T23:00:00Z' }), false)
})

test('Hankyung finance is separately diagnosed when the economy feed is blocked', async () => {
  const { SOURCES, collectNews } = await import('../lib/news.js')
  const sources = SOURCES.filter(s => s.id.startsWith('hankyung-'))
  assert.equal(sources.length, 2)
  const payload = await collectNews(async url => url.endsWith('/economy') ? new Response(null, { status: 403 }) : new Response(`<rss><channel><item><title>한국 기업 실적 개선</title><link>https://www.hankyung.com/article/test</link><pubDate>${new Date(now).toUTCString()}</pubDate></item></channel></rss>`), sources, now)
  assert.equal(payload.sources.find(s => s.id === 'hankyung-economy').error, 'http_403')
  assert.equal(payload.sources.find(s => s.id === 'hankyung-finance').status, 'ok')
  assert.equal(payload.items[0].publisher, '한국경제')
})
