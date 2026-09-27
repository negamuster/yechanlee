import test from 'node:test'
import assert from 'node:assert/strict'
import { compareSeries, parseHistory, createSectorHandler } from '../lib/sector-performance.js'
const points = [['2025-12-31',100],['2026-08-25',110],['2026-09-18',115],['2026-09-24',120],['2026-09-25',125]].map(([date,price])=>({date,price}))
test('YTD uses prior year close, week/month use dates, VOO difference uses percentage points',()=>{
 const r=compareSeries(points.map(p=>({...p,price:p.date==='2026-09-25'?130:p.price})),points)
 assert.equal(r.returns.ytd,30.000000000000004)
 assert.ok(Math.abs(r.relative.ytd-5)<1e-10)
 assert.equal(r.starts['1w'],'2026-09-18')
 assert.equal(r.starts['1m'],'2026-08-25')
 assert.ok(Math.abs(r.returns['1d']-(130/120-1)*100)<1e-10)
})
test('missing exact benchmark endpoints and absent benchmark are unavailable, not zero',()=>{
 assert.equal(compareSeries(points.slice(0,-1),points).returns['1d'],null)
 assert.equal(compareSeries(points.filter(p=>p.date!=='2025-12-31'),points).returns.ytd,null)
 assert.equal(compareSeries(points,[]).asOf,null)
})
const chart=(symbol='VOO')=>({meta:{symbol,currency:'USD',currentTradingPeriod:{regular:{end:Date.parse('2026-09-25T20:00:00Z')/1000}}},timestamp:points.map(p=>Date.parse(p.date+'T13:30:00Z')/1000),indicators:{quote:[{close:points.map(p=>p.price)}]}})
test('exclude unfinished session, allow completed session, reject wrong instrument and null prices',()=>{
 assert.equal(parseHistory(chart(),'VOO',Date.parse('2026-09-25T18:00:00Z')).at(-1).date,'2026-09-24')
 assert.equal(parseHistory(chart(),'VOO',Date.parse('2026-09-25T20:16:00Z')).at(-1).date,'2026-09-25')
 assert.deepEqual(parseHistory(chart(),'XLK'),[])
 const bad=chart();bad.indicators.quote[0].close[4]=null
 assert.equal(parseHistory(bad,'VOO',Date.parse('2026-09-26')).at(-1).date,'2026-09-24')
})
test('weekend cutoff uses last available session; same-day pre-close is not reported as full day',()=>{
 assert.equal(parseHistory(chart(),'VOO',Date.parse('2026-09-26')).length,5)
})
test('shared cache, partial failure, stale fallback and method validation',async()=>{
 let calls=0, failure=false, clock=Date.parse('2026-09-26')
 const handler=createSectorHandler({now:()=>clock,fetcher:async url=>{calls++;if(failure||url.includes('/XLK?'))throw Error();const symbol=url.split('/chart/')[1].split('?')[0];return Response.json({chart:{result:[chart(symbol)]}})}})
 const req=new Request('http://localhost/api/sector-performance')
 const responses=await Promise.all([handler(req),handler(req)])
 const data=await responses[0].json()
 assert.equal(calls,12);assert.equal(data.sectors.length,11);assert.equal(data.sectors[0].returns['1d'],null)
 assert.equal(responses[1].status,200)
 await handler(req);assert.equal(calls,12)
 clock+=300001;failure=true
 const stale=await handler(req);assert.equal((await stale.json()).stale,true);assert.equal(stale.headers.get('cache-control'),'no-store')
 assert.equal((await handler(new Request(req,{method:'POST'}))).status,405)
})
test('total upstream failure returns 503 without fabricated returns',async()=>{
 const handler=createSectorHandler({fetcher:async()=>{throw Error()}})
 const response=await handler(new Request('http://localhost/api/sector-performance'))
 assert.equal(response.status,503);assert.ok((await response.json()).sectors.every(s=>s.returns.ytd===null))
})
