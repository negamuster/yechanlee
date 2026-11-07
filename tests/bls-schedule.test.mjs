import test from 'node:test'
import assert from 'node:assert/strict'
import { blsScheduleUrl, parseBLSSchedule, readBLSSchedule } from '../lib/bls-schedule.js'
import { createCalendarHandler, readBLSSnapshot, SOURCES } from '../lib/calendar.js'
import { FRED_RELEASES, FRED_URL } from '../lib/fred-calendar.js'

const row = (date, time, title) => `<tr><td class="date-cell">${date}</td><td class="time-cell">${time}</td><td class="desc-cell"><strong>${title}</strong></td></tr>`
const page = rows => `<html><body>${Array.from({length:12}, (_, index) => `<table class="release-list"><tbody>${index === 10 ? rows : ''}</tbody></table>`).join('')}All times on calendar are Eastern Time.</body></html>`
const annual = page(row('Tuesday, November 10, 2026', '08:30 AM', 'Real Earnings')
  + row('Wednesday, November 11, 2026', '', 'Veterans Day')
  + row('Friday, November 20, 2026', '10:00 AM', 'Total Factor Productivity for Major Industries'))
const schedule = parseBLSSchedule(annual, 2026)
const checkedAt = '2026-11-07T06:00:00.000Z'
const ics = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:real\nDTSTART:20261110T133000Z\nSUMMARY:Real Earnings\nEND:VEVENT\nEND:VCALENDAR'

test('official annual schedule supplements missing releases with Eastern Time and its own source URL', () => {
  assert.deepEqual(schedule.events.map(event => [event.title, event.startAt]), [
    ['Real Earnings','2026-11-10T13:30:00.000Z'],
    ['Total Factor Productivity for Major Industries','2026-11-20T15:00:00.000Z'],
  ])
  const snapshot = {version:1,sourceUrl:SOURCES.bls.url,checkedAt,ics,schedule}
  const {events} = readBLSSnapshot(snapshot, Date.parse(checkedAt))
  assert.equal(events.length,2)
  assert.ok(events.every(event => event.sourceUrl === blsScheduleUrl(2026)))
  assert.equal(readBLSSnapshot({...snapshot,schedule:undefined},Date.parse(checkedAt)).events.length,1)
  assert.equal(readBLSSnapshot({...snapshot,sourceUrl:blsScheduleUrl(2026),ics:undefined},Date.parse(checkedAt)).events.length,2)
})

test('live ICS keeps revised dates while missing families use the supplement with its original time', async () => {
  const snapshot = {version:1,sourceUrl:SOURCES.bls.url,checkedAt,ics,schedule}
  const revised = ics.replace('20261110T133000Z','20261113T133000Z')
  const handler = createCalendarHandler({now:()=>Date.parse('2026-11-12T06:00:00Z'),blsSnapshot:snapshot,fetchImpl:async url=>url===SOURCES.bls.url?new Response(revised):new Response(null,{status:403})})
  const body = await (await handler(new Request('https://example.com/api/calendar?mode=month&from=2026-11-01&to=2026-11-30'))).json()
  assert.equal(body.events.filter(event=>event.title==='Real Earnings').length,1)
  assert.equal(body.events.find(event=>event.title==='Real Earnings').date,'2026-11-13')
  assert.ok(body.events.some(event=>event.title==='Total Factor Productivity for Major Industries'))
  const source = body.sources.find(source=>source.name==='BLS selected releases')
  assert.equal(source.updatedAt,checkedAt)
  assert.equal(source.state,'stale')
})

test('annual parser rejects partial pages, unknown rows, changed timezone and malformed schedule data', () => {
  for (const html of [annual.replace('</html>',''), annual.replace('Eastern Time','Central Time'),
    annual.replace('<table class="release-list">','<table>'), annual.replace('10:00 AM','25:00 AM'),
    annual.replace('Veterans Day','Unknown time release'), annual.replace('November 20','November 31')]) {
    assert.throws(() => parseBLSSchedule(html,2026))
  }
  assert.throws(() => readBLSSchedule({...schedule,sourceUrl:'https://example.com'}))
  assert.throws(() => readBLSSchedule({...schedule,events:[...schedule.events,...schedule.events]}))
  assert.throws(() => readBLSSchedule({...schedule,events:[{...schedule.events[0],date:'2027-11-10'}]}))
})

test('moved annual dates replace old ICS dates and expired snapshots leave only FRED coverage', async () => {
  let now = Date.parse(checkedAt)
  const moved = {...schedule,events:[{...schedule.events[0],date:'2026-11-12',startAt:'2026-11-12T13:30:00.000Z'}]}
  const bls = {version:1,sourceUrl:SOURCES.bls.url,checkedAt,ics,schedule:moved}
  assert.equal(readBLSSnapshot(bls,now).events[0].date,'2026-11-12')
  const fred = {version:1,sourceUrl:FRED_URL,checkedAt:'2026-11-14T06:00:00.000Z',from:'2026-11-01',to:'2026-11-30',releaseIds:Object.keys(FRED_RELEASES).map(Number),events:[{rid:10,date:'2026-11-10',startAt:'2026-11-10T13:30:00.000Z'}]}
  const handler = createCalendarHandler({now:()=>now,blsSnapshot:bls,fredSnapshot:fred,fetchImpl:async()=>new Response(null,{status:403})})
  const request = () => new Request('https://example.com/api/calendar?mode=month&from=2026-11-01&to=2026-11-30')
  let body = await (await handler(request())).json()
  assert.ok(body.events.some(event => event.title === 'Real Earnings'))
  now = Date.parse('2026-11-15T06:00:00Z')
  body = await (await handler(request())).json()
  assert.deepEqual(body.events.map(event=>event.title),['Consumer Price Index'])
  assert.equal(body.sources.find(source=>source.name==='BLS').state,'unavailable')
  assert.throws(()=>readBLSSnapshot(bls,now))
})
