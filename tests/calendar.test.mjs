import test from 'node:test'
import assert from 'node:assert/strict'
import { parseICS, parseFed, parseEarnings, zonedISO, createCalendarHandler } from '../lib/calendar.js'

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
    return new Response(url.includes('federalreserve') ? JSON.stringify({events:[]}) : 'BEGIN:VCALENDAR\nEND:VCALENDAR')
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
