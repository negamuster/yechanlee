import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseCompanyMap,validCompanyMap,createCompanyMapHandler} from '../lib/company-map.js'
import {inspectHealth} from '../lib/data-health.js'
import {marketMapLayout} from '../src/lib/companyMap.ts'
const now=Date.parse('2026-10-29T12:00:00Z'), at=new Date(now).toISOString()
const meta={checkedAt:'2026-10-29',companies:{GOOG:{issuer:'alphabet',preferred:'GOOGL',sector:'communication'},GOOGL:{issuer:'alphabet',preferred:'GOOGL',sector:'communication'}}}
const row=(symbol,marketCap=100,extra={})=>({symbol,quoteType:'EQUITY',exchange:'NMS',currency:'USD',marketCap,regularMarketTime:now/1000-3600,regularMarketChangePercent:1,longName:symbol,...extra})
const payload=quotes=>({finance:{result:[{criteriaMeta:{sortField:'intradaymarketcap',sortType:'DESC'},quotes}]}})
const result=()=>parseCompanyMap(payload([row('NVDA',500),row('AAPL',300)]),meta,at,now)
test('market map rejects wrong ranking contract and excludes OTC/preferred/currency/bad or future financial values without fabricating zeros',()=>{
 const parsed=parseCompanyMap(payload([row('NVDA',500),row('GOOG',400),row('GOOGL',410),row('JPM-PC',200),row('OTC',200,{exchange:'PNK'}),row('BAD',null),row('STR','100'),row('EUR',100,{currency:'EUR'}),row('FUT',100,{regularMarketTime:now/1000+10000}),row('JPM',100,{regularMarketChangePercent:null})]),meta,at,now)
 assert.deepEqual(parsed.companies.map(c=>c.symbol),['NVDA','GOOGL','JPM'])
 assert.equal(parsed.companies.at(-1).changePercent,null)
 assert.equal(parsed.excluded,7)
 assert.equal(parsed.companies[0].sector,'unknown')
 assert.equal(validCompanyMap(parsed),true)
 assert.throws(()=>parseCompanyMap({finance:{result:[{quotes:[row('AAPL')]}]}},meta,at,now))
 assert.throws(()=>parseCompanyMap(payload([row('BAD',0)]),meta,at,now))
})
test('coalesced refresh and retained fallback keep original valuation/quote receipts and retry backoff',async()=>{
 let clock=now,calls=0,release,fail=false
 const handler=createCompanyMapHandler({metadata:meta,now:()=>clock,fetcher:async()=>{calls++;if(fail)throw Error('down');await new Promise(r=>release=r);return Response.json(payload([row('NVDA')]))}})
 const req=new Request('http://localhost/map'), a=handler(req),b=handler(req)
 release();const [ra,rb]=await Promise.all([a,b]);const original=await ra.json();assert.deepEqual(await rb.json(),original);assert.equal(calls,1)
 clock+=300001;fail=true
 const fallback=await (await handler(req)).json();assert.equal(fallback.stale,true);assert.equal(fallback.sourceError,true);assert.equal(fallback.fetchedAt,original.fetchedAt);assert.equal(fallback.companies[0].quoteAt,original.companies[0].quoteAt)
 assert.equal((await handler(req)).status,200);assert.equal(calls,2)
 assert.deepEqual(inspectHealth('company-map',fallback,clock).errors,[]);assert.ok(inspectHealth('company-map',fallback,clock).warnings.length)
})
test('cold source failure uses explicit stale snapshot and an unavailable snapshot returns 503, not an empty successful map',async()=>{
 const fetcher=async()=>{throw Error('offline')},req=new Request('http://localhost/map')
 const response=await createCompanyMapHandler({metadata:meta,snapshot:result(),fetcher,now:()=>now})(req)
 assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).stale,true)
 assert.equal((await createCompanyMapHandler({metadata:meta,fetcher,now:()=>now})(req)).status,503)
 assert.equal((await createCompanyMapHandler({metadata:meta,fetcher})(new Request(req,{method:'POST'}))).status,405)
})
test('weighted rectangles preserve market-cap ratios, cover bounds without overlap, and do not mutate source ordering',()=>{
 const companies=Array.from({length:30},(_,i)=>({symbol:`T${i}`,marketCap:100000/(i+1)}));const before=structuredClone(companies)
 for(const [width,height] of [[280,460],[1100,560],[1,1]]) {
  const rects=marketMapLayout(companies,width,height),sum=companies.reduce((s,c)=>s+c.marketCap,0)
  assert.equal(rects.length,companies.length)
  for(const r of rects) {
   assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=width+1e-8&&r.y+r.height<=height+1e-8)
   assert.ok(Math.abs(r.width*r.height/(width*height)-r.company.marketCap/sum)<1e-10)
   for(const b of rects) if(b!==r) assert.ok(Math.min(r.x+r.width,b.x+b.width)-Math.max(r.x,b.x)<1e-8||Math.min(r.y+r.height,b.y+b.height)-Math.max(r.y,b.y)<1e-8)
  }
 }
 assert.deepEqual(companies,before);assert.deepEqual(marketMapLayout([],0,0),[])
})
test('checked company snapshot retains positive caps and original quote times and has no duplicate issuer aliases',()=>{
 const snapshot=JSON.parse(readFileSync(new URL('../data/company-map.json',import.meta.url)))
 assert.equal(validCompanyMap(snapshot),true);assert.ok(snapshot.companies.some(c=>c.symbol==='GOOGL'));assert.ok(!snapshot.companies.some(c=>c.symbol==='GOOG'||c.symbol==='BRK-A'))
 assert.ok(snapshot.companies.some(c=>c.symbol==='BRK-B'));assert.equal(snapshot.sourceCount,100)
})
