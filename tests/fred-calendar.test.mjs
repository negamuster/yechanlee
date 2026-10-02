import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFREDCalendar, readFREDSnapshot, FRED_RELEASES, FRED_URL } from '../lib/fred-calendar.js'
import { createCalendarHandler, SOURCES } from '../lib/calendar.js'
const page = (date, time, rid=10) => `<div id="release-dates-pager"><tbody><tr><td><span>${date}</span></td></tr><tr><td>${time}</td><td><a href="/release?rid=${rid}">Title</a></td></tr></tbody></table>Releases 1 - 1 of 1</div>All times are US Central Time.`
test('FRED Central Time conversion respects DST and leaves unknown time unset', () => {
  assert.equal(parseFREDCalendar(page('Wednesday October 14, 2026','7:30 am'),10)[0].startAt,'2026-10-14T12:30:00.000Z')
  assert.equal(parseFREDCalendar(page('Tuesday November 10, 2026','7:30 am'),10)[0].startAt,'2026-11-10T13:30:00.000Z')
  assert.equal(parseFREDCalendar(page('Tuesday November 10, 2026','N/A'),10)[0].startAt,null)
})
test('FRED parser rejects partial pagination, changed markup, mismatched releases and invalid times', () => {
  for (const html of [page('Wednesday October 14, 2026','7:30 am').replace('1 of 1','1 of 2'),'<html>Access denied</html>',page('Wednesday October 14, 2026','7:30 am',50),page('Wednesday October 14, 2026','25:30 am')]) assert.throws(()=>parseFREDCalendar(html,10))
})
const checkedAt='2026-10-02T12:00:00.000Z'
const snapshot={version:1,sourceUrl:FRED_URL,checkedAt,from:'2026-08-01',to:'2027-02-01',releaseIds:Object.keys(FRED_RELEASES).map(Number),events:[{rid:10,date:'2026-10-15',startAt:'2026-10-15T12:30:00.000Z'}]}
test('FRED rejects expired data and missing release-family coverage',()=>{
  assert.throws(()=>readFREDSnapshot(snapshot,Date.parse(checkedAt)+8*86400000))
  assert.throws(()=>readFREDSnapshot({...snapshot,releaseIds:[10]},Date.parse(checkedAt)))
})
test('Newer FRED replaces moved BLS dates while preserving other BLS events and source timestamps', async()=>{
  const bls={version:1,sourceUrl:SOURCES.bls.url,checkedAt:'2026-10-01T12:00:00.000Z',ics:'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:cpi\nDTSTART:20261014T123000Z\nSUMMARY:Consumer Price Index\nEND:VEVENT\nBEGIN:VEVENT\nUID:real\nDTSTART:20261014T123000Z\nSUMMARY:Real Earnings\nEND:VEVENT\nEND:VCALENDAR'}
  let live=false, now=Date.parse(checkedAt)
  const handler=createCalendarHandler({now:()=>now,blsSnapshot:bls,fredSnapshot:snapshot,fetchImpl:async url=>{if(live&&url===SOURCES.bls.url)return new Response(bls.ics);throw new Error('offline')}})
  const req=()=>new Request('https://example.com/api/calendar?mode=month&from=2026-10-01&to=2026-10-31')
  let body=await (await handler(req())).json()
  assert.deepEqual(body.events.map(e=>[e.title,e.date]),[['Real Earnings','2026-10-14'],['Consumer Price Index','2026-10-15']])
  assert.equal(body.sources.find(s=>s.name==='BLS').updatedAt,bls.checkedAt)
  assert.equal(body.sources.find(s=>s.name==='FRED (BLS)').updatedAt,checkedAt)
  now+=16*60000;live=true;body=await(await handler(req())).json()
  assert.equal(body.events.find(e=>e.title==='Consumer Price Index').date,'2026-10-14')
  assert.ok(body.sources.every(s=>s.name!=='FRED (BLS)'))
})
