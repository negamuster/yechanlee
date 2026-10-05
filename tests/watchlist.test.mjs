import test from 'node:test'
import assert from 'node:assert/strict'
import { createWatchlistHandler, parseTickers } from '../lib/watchlist.js'
import { sortStocks, isWebUrl } from '../src/lib/watchlist.ts'
test('bounded ticker validation prevents arbitrary URLs and duplicate requests',()=>{
 assert.deepEqual(parseTickers('AAPL,BRK.B,AAPL'),['AAPL','BRK.B'])
 for(const value of ['', 'https://example.com','AAPL/../x',Array(21).fill('AAPL').join(',')]) assert.equal(parseTickers(value),null)
 assert.equal(isWebUrl('javascript:alert(1)'),false)
})
test('quote cache deduplicates, maps share classes, and retains original timestamp on failure',async()=>{
 let now=Date.parse('2026-10-05T14:00:00Z'),calls=0,fail=false
 const handler=createWatchlistHandler({now:()=>now,fetchImpl:async url=>{calls++;if(fail)throw Error();assert.ok(url.includes('BRK-B'));return Response.json({chart:{result:[{meta:{symbol:'BRK-B',regularMarketPrice:110,regularMarketTime:1791208800,previousClose:100,currency:'USD'}}]}})}})
 const request=()=>new Request('https://example.com/api/watchlist?tickers=BRK.B')
 const first=await(await handler(request())).json();assert.equal(first.quotes[0].ticker,'BRK.B');assert.ok(Math.abs(first.quotes[0].changePercent-10)<1e-8)
 await handler(request());assert.equal(calls,1)
 now+=130000;fail=true
 const stale=await(await handler(request())).json();assert.equal(stale.quotes[0].stale,true);assert.equal(stale.quotes[0].asOf,first.quotes[0].asOf);assert.equal(stale.quotes[0].checkedAt,first.quotes[0].checkedAt)
 assert.equal((await handler(new Request('https://example.com/api/watchlist?tickers=AAPL',{method:'POST'}))).status,405)
 assert.equal((await handler(new Request('https://example.com/api/watchlist?tickers=AAPL',{headers:{Origin:'https://other.com'}}))).status,403)
})
test('sorts all saved stocks without treating missing change as zero or mutating saved order',()=>{
 const stocks=[{ticker:'A',name:'Alpha'},{ticker:'B',name:'Beta'},{ticker:'C',name:'Charlie'}]
 const quotes={B:{changePercent:-5},C:{changePercent:2}}
 assert.deepEqual(sortStocks(stocks,quotes,'change').map(s=>s.ticker),['C','B','A'])
 assert.deepEqual(sortStocks(stocks,quotes,'saved'),stocks)
 assert.deepEqual(stocks.map(s=>s.ticker),['A','B','C'])
})
