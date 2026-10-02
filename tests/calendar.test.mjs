import test from 'node:test'
import assert from 'node:assert/strict'
import { parseICS, parseFed, parseEarnings, zonedISO, createCalendarHandler, readBLSSnapshot, SOURCES } from '../lib/calendar.js'

test('New York DST and Korea midnight rollover', () => {
  assert.equal(zonedISO('2026-10-01', 14, 0), '2026-10-01T18:00:00.000Z')
  assert.equal(zonedISO('2026-11-02', 14, 0), '2026-11-02T19:00:00.000Z')
  assert.equal(new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul'}).format(new Date(zonedISO('2026-10-01', 14, 0))), '2026-10-02')
})
test('ICS supports folded titles, UTC, eastern time and cancelled events', () => {
  const raw = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:one\r\nDTSTART;TZID=US-Eastern:20261002T083000\r\nSUMMARY:Employment Situ\r\n ation\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:two\r\nDTSTART:20261102T133000Z\r\nSUMMARY:GDP\\, Advance\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART:20261102T133000Z\r\nSUMMARY:Cancelled\r\nSTATUS:CANCELLED\r\nEND:VEVENT\r\nEND:VCALENDAR'
  const events = parseICS(raw, 'bls')
  assert.equal(events.length, 2)
  assert.equal(events[0].title, 'Employment Situation')
  assert.equal(events[0].startAt, '2026-10-02T12:30:00.000Z')
  assert.equal(events[1].title, 'GDP, Advance')
  assert.equal(events[1].startAt, '2026-11-02T13:30:00Z')
})
test('Fed time and date-only events stay distinct; HTML is plain text', () => {
  const events = parseFed({events:[{title:'FOMC Meeting',time:'2:00 p.m.',month:'2026-10',days:'28',type:'FOMC',description:'&lt;p&gt;Meeting&lt;/p&gt;'}, {title:'Conference',time:'',month:'2026-10',days:'1-2',type:'Conferences'}]})
  assert.equal(events[0].startAt, '2026-10-28T18:00:00.000Z')
  assert.equal(events[0].description, 'Meeting')
  assert.equal(events[1].startAt, null)
})
test('Earnings never invent a timestamp or confirmed announcement', () => {
  const rows = parseEarnings({data:{rows:[{symbol:'ACN',name:'Accenture',time:'time-pre-market'},{symbol:'NKE',name:'Nike',time:'time-after-hours'}]}}, '2026-10-01')
  assert.equal(rows[0].session, 'pre'); assert.equal(rows[1].session, 'post')
  assert.equal(rows[0].startAt, null); assert.equal(rows[0].estimated, true)
  assert.throws(() => parseEarnings({data:null}, '2026-10-01'))
  assert.deepEqual(parseEarnings({data:{rows:null}}, '2026-10-01'), [])
})
test('Handler validates ranges, caches successes and exposes stale/failing sources', async () => {
  let clock = Date.parse('2026-10-01T15:00:00Z'), fail = false, calls = 0
  const fetchImpl = async url => {
    calls++
    if (fail || url.includes('nasdaq')) throw new Error('offline')
    return new Response(url.includes('federalreserve') ? JSON.stringify({events:[]}) : 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:fixture\nDTSTART:20261014T123000Z\nSUMMARY:Consumer Price Index\nEND:VEVENT\nEND:VCALENDAR')
  }
  const handler = createCalendarHandler({now:()=>clock,fetchImpl})
  const request = () => new Request('https://example.com/api/calendar?from=2026-10-01&to=2026-10-01')
  assert.equal((await handler(new Request('https://example.com/api/calendar?from=bad'))).status,400)
  assert.equal((await handler(new Request('https://example.com/api/calendar?from=2026-10-01&to=2026-10-10'))).status,400)
  const first = await (await handler(request())).json()
  assert.equal(first.sources.find(s=>s.name==='Nasdaq').state, 'unavailable')
  await handler(request()); assert.equal(calls,5) // 3 successful caches + a failed Nasdaq retry
  clock += 16 * 60000; fail = true
  const stale = await (await handler(request())).json()
  assert.equal(stale.sources[0].state, 'stale')
  clock += 25 * 3600000
  assert.equal((await handler(request())).status,503)
})

test('Monthly schedule avoids bulk earnings requests; selected day loads earnings separately', async () => {
  const urls = []
  const handler = createCalendarHandler({now:()=>Date.parse('2026-10-01T12:00:00Z'),fetchImpl:async url=>{
    urls.push(url)
    return new Response(url.includes('nasdaq') ? JSON.stringify({data:{rows:[]}}) : url.includes('federalreserve') ? JSON.stringify({events:[]}) : 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:fixture\nDTSTART:20261014T123000Z\nSUMMARY:Consumer Price Index\nEND:VEVENT\nEND:VCALENDAR')
  }})
  assert.equal((await handler(new Request('https://example.com/api/calendar?from=2026-10-01&to=2026-10-31&mode=month'))).status,200)
  assert.equal(urls.length,3)
  assert.ok(urls.every(url=>!url.includes('nasdaq')))
  assert.equal((await handler(new Request('https://example.com/api/calendar?from=2026-10-01&to=2026-10-01&mode=earnings'))).status,200)
  assert.equal(urls.length,4)
  assert.ok(urls[3].includes('nasdaq'))
  const weekend=await handler(new Request('https://example.com/api/calendar?from=2026-10-03&to=2026-10-03&mode=earnings'))
  assert.equal(weekend.status,200)
  assert.deepEqual((await weekend.json()).events,[])
  assert.equal((await handler(new Request('https://example.com/api/calendar?from=2026-10-01&to=2026-11-01&mode=month'))).status,400)
  assert.equal((await handler(new Request('https://example.com/api/calendar?from=2026-10-01&to=2026-10-03&mode=earnings'))).status,400)
})

const officialICS = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:cpi\nDTSTART:20261014T123000Z\nSUMMARY:Consumer Price Index\nEND:VEVENT\nEND:VCALENDAR'
const snapshotAt = '2026-10-01T12:00:00.000Z'
const snapshot = { version: 1, sourceUrl: SOURCES.bls.url, checkedAt: snapshotAt, ics: officialICS }
const monthRequest = () => new Request('https://example.com/api/calendar?from=2026-10-01&to=2026-10-31&mode=month')
test('BLS fallback preserves verification time, caches fallback honestly, and expires', async () => {
  let clock = Date.parse(snapshotAt) + 3600000
  let calls = 0
  const handler = createCalendarHandler({ now: () => clock, blsSnapshot: snapshot, fetchImpl: async () => { calls++; throw new Error('offline') } })
  let result = await (await handler(monthRequest())).json()
  assert.equal(result.events[0].title, 'Consumer Price Index')
  assert.equal(result.sources[0].state, 'snapshot')
  assert.equal(result.sources[0].updatedAt, snapshotAt)
  result = await (await handler(monthRequest())).json()
  assert.equal(calls, 5)
  assert.equal(result.sources[0].state, 'snapshot')
  clock += 16 * 60000
  result = await (await handler(monthRequest())).json()
  assert.equal(result.sources[0].state, 'snapshot')
  clock += 3 * 86400000
  result = await (await handler(monthRequest())).json()
  assert.equal(result.sources[0].state, 'stale')
  assert.equal(result.sources[0].updatedAt, snapshotAt)
  clock += 5 * 86400000
  assert.equal((await handler(monthRequest())).status, 503)
})
test('Latest remote snapshot replaces removed events; live source takes precedence', async () => {
  let live = false, clock = Date.parse(snapshotAt) + 3600000
  const replacement = { ...snapshot, checkedAt: new Date(clock).toISOString(), ics: officialICS.replace('Consumer Price Index', 'Updated Release').replace('UID:cpi', 'UID:new') }
  const handler = createCalendarHandler({ now: () => clock, blsSnapshot: snapshot, snapshotUrl: 'https://example.com/snapshot', fetchImpl: async url => {
    if (url.endsWith('/snapshot')) return Response.json(replacement)
    if (live && url === SOURCES.bls.url) return new Response(officialICS)
    throw new Error('offline')
  } })
  let result = await (await handler(monthRequest())).json()
  assert.deepEqual(result.events.map(e => e.title), ['Updated Release'])
  assert.equal(result.sources[0].updatedAt, replacement.checkedAt)
  live = true; clock += 16 * 60000
  result = await (await handler(monthRequest())).json()
  assert.deepEqual(result.events.map(e => e.title), ['Consumer Price Index'])
  assert.equal(result.sources[0].state, 'ok')
})
test('Snapshot validation rejects partial, empty, wrongly sourced and future-dated data', () => {
  const now = Date.parse(snapshotAt)
  for (const invalid of [null, { ...snapshot, sourceUrl: 'https://example.com' }, { ...snapshot, ics: 'BEGIN:VCALENDAR\nEND:VCALENDAR' }, { ...snapshot, ics: officialICS.replace('END:VCALENDAR', '') }, { ...snapshot, checkedAt: '2026-10-02T12:00:00Z' }]) {
    assert.throws(() => readBLSSnapshot(invalid, now))
  }
  assert.throws(() => readBLSSnapshot(snapshot, now + 8 * 86400000))
})
