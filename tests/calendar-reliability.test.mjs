import test from 'node:test'
import assert from 'node:assert/strict'
import { createCalendarHandler, SOURCES } from '../lib/calendar.js'
import { FRED_RELEASES, FRED_URL } from '../lib/fred-calendar.js'
const minute = 60000, day = 86400000, at = Date.parse('2026-10-01T12:00:00Z')
const req = () => new Request('https://example.com/api/calendar?mode=month&from=2026-10-01&to=2026-10-31')
const ics = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:cpi\nDTSTART:20261014T123000Z\nSUMMARY:Consumer Price Index\nEND:VEVENT\nEND:VCALENDAR'
const bls = { version:1, sourceUrl:SOURCES.bls.url, checkedAt:new Date(at).toISOString(), ics }
const fred = { version:1, sourceUrl:FRED_URL, checkedAt:new Date(at).toISOString(), from:'2026-08-01', to:'2027-02-01', releaseIds:Object.keys(FRED_RELEASES).map(Number), events:[{rid:10,date:'2026-10-14',startAt:'2026-10-14T12:30:00Z'}] }
const named = (body, name) => body.sources.find(s => s.name === name)

test('403 requests are shared, wait 30 minutes, and recover without rewriting collection time', async () => {
  let clock = at + minute, blocked = true, calls = 0
  const handler = createCalendarHandler({ now:()=>clock, blsSnapshot:bls, fetchImpl:async () => {
    calls++; await Promise.resolve()
    return blocked ? new Response('not public', {status:403}) : new Response(ics)
  } })
  const results = await Promise.all(Array.from({length:8}, () => handler(req()).then(r => r.json())))
  assert.equal(calls,3)
  for (const body of results) {
    const source = named(body,'BLS')
    assert.equal(source.state,'snapshot'); assert.equal(source.updatedAt,bls.checkedAt)
    assert.equal(source.error,'http_403'); assert.equal(source.checkedAt,new Date(clock).toISOString())
    assert.equal(source.nextRetryAt,new Date(clock + 30 * minute).toISOString())
    assert.ok(!JSON.stringify(body).includes('not public'))
  }
  clock += 29 * minute; blocked = false
  assert.equal(named(await (await handler(req())).json(),'BLS').state,'snapshot'); assert.equal(calls,3)
  clock += minute
  const body = await (await handler(req())).json()
  assert.equal(named(body,'BLS').state,'ok'); assert.equal(named(body,'BLS').error,undefined)
  assert.equal(named(body,'BLS').updatedAt,new Date(clock).toISOString()); assert.equal(calls,6)
})

test('503 Retry-After delays calendar retry and repeated failures back off', async () => {
  let clock = at, calls = 0
  const handler = createCalendarHandler({now:()=>clock,fetchImpl:async()=>{calls++;return new Response(null,{status:503,headers:{'Retry-After':'120'}})}})
  const first = await (await handler(req())).json()
  assert.equal(named(first,'BLS').nextRetryAt,new Date(at + 2 * minute).toISOString())
  clock += minute; await handler(req()); assert.equal(calls,3)
  clock += minute; await handler(req()); assert.equal(calls,6)
  clock += 2 * minute
  const third = await (await handler(req())).json()
  assert.equal(named(third,'BLS').nextRetryAt,new Date(clock + 4 * minute).toISOString())
})

test('BLS/FRED expire on a negative-cache hit, even within a 15-minute snapshot cache', async () => {
  let clock = at + 7 * day - minute
  const handler = createCalendarHandler({now:()=>clock,blsSnapshot:bls,fredSnapshot:fred,fetchImpl:async()=>new Response(null,{status:403})})
  let body = await (await handler(req())).json()
  assert.ok(body.events.length)
  clock += 2 * minute
  const response = await handler(req()); body = await response.json()
  assert.equal(response.status,503); assert.equal(body.events.length,0)
  assert.ok(body.sources.every(s=>s.state==='unavailable'))
})

test('expired 24-hour retained calendars disappear before another attempt is due', async () => {
  let clock = at, working = true, calls = 0
  const handler = createCalendarHandler({now:()=>clock,fetchImpl:async()=>{calls++;return working?new Response(ics):new Response(null,{status:403})}})
  await handler(req()); working=false; clock += day - minute
  let body = await (await handler(req())).json()
  assert.equal(named(body,'BEA').state,'stale'); assert.equal(named(body,'BEA').updatedAt,new Date(at).toISOString())
  clock += 2 * minute; const before=calls
  body=await(await handler(req())).json()
  assert.equal(named(body,'BEA').state,'unavailable'); assert.ok(!body.events.some(e=>e.source==='BEA'))
  assert.equal(calls,before)
})

test('remote FRED failures are coalesced and negatively cached without hiding fallback failure', async () => {
  let clock=at, remote=0
  const handler=createCalendarHandler({now:()=>clock,fredSnapshotUrl:'https://example.com/fred',fetchImpl:async url=>{
    if(url.endsWith('/fred')){remote++;await Promise.resolve();return new Response(null,{status:503})}
    return new Response(null,{status:403})
  }})
  const bodies=await Promise.all(Array.from({length:6},()=>handler(req()).then(r=>r.json())))
  assert.equal(remote,1); assert.equal(named(bodies[0],'FRED (BLS)').state,'unavailable')
  await handler(req()); assert.equal(remote,1)
  clock+=minute;await handler(req());assert.equal(remote,2)
})

test('snapshot reads preserve the newest verified copy when remote collection regresses', async () => {
  let clock=at+day, remote={...bls,checkedAt:new Date(clock).toISOString(),ics:ics.replace('Consumer Price Index','New release')}
  const handler=createCalendarHandler({now:()=>clock,snapshotUrl:'https://example.com/bls',fetchImpl:async url=>url.endsWith('/bls')?Response.json(remote):new Response(null,{status:403})})
  let body=await(await handler(req())).json();assert.equal(body.events[0].title,'New release')
  remote=bls;clock+=16*minute
  body=await(await handler(req())).json();assert.equal(body.events[0].title,'New release')
  assert.equal(named(body,'BLS').updatedAt,new Date(at+day).toISOString())
})

test('calendar body deadlines and size limits preserve honest unavailable states', async () => {
  for(const fetchImpl of [()=>new Promise(()=>{}), async()=>new Response(new ReadableStream({start(){}})), async()=>new Response('x',{headers:{'content-length':String(3*1024*1024)}}), async()=>new Response(ics.replace('END:VCALENDAR',''))]) {
    const handler=createCalendarHandler({now:()=>at,timeoutMs:20,fetchImpl})
    const response=await handler(req()),body=await response.json()
    assert.equal(response.status,503);assert.equal(body.events.length,0)
    assert.ok(body.sources.every(s=>s.error&&s.nextRetryAt));assert.equal(response.headers.get('cache-control'),'no-store')
  }
})
