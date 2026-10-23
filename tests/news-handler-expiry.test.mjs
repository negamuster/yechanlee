import test from 'node:test'
import assert from 'node:assert/strict'
import { createNewsHandler } from '../lib/news-handler.js'
const at=Date.parse('2026-10-23T12:00:00Z'), hour=3600000
const xml=date=>`<rss><channel><item><title>Market stocks earnings rise</title><link>https://www.bbc.com/news/business/fixture</link><pubDate>${new Date(date).toUTCString()}</pubDate></item></channel></rss>`
const request=()=>new Request('https://example.com/api/news')

test('CDN freshness plus SWR never outlives the earliest article deadline, including origin-cache hits', async()=>{
  const original=globalThis.fetch;let clock=at,calls=0
  globalThis.fetch=async()=>{calls++;return new Response(xml(at-72*hour+2000))}
  try{
    const handler=createNewsHandler({now:()=>clock})
    let response=await handler(request())
    assert.equal(response.status,200)
    assert.equal(response.headers.get('cache-control'),'public, max-age=0, s-maxage=2, stale-while-revalidate=0')
    const collected=calls;clock+=1000
    response=await handler(request());assert.equal(response.headers.get('cache-control'),'no-store')
    clock+=1001;response=await handler(request())
    assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store')
    const body=await response.json();assert.deepEqual(body.items,[])
    assert.equal(body.sources.find(s=>s.id==='bbc-business').status,'empty')
    assert.equal(calls,collected)
  }finally{globalThis.fetch=original}
})

test('normal fresh feeds retain bounded CDN caching while retained stale articles use no-store', async()=>{
  const original=globalThis.fetch;let clock=at,offline=false
  globalThis.fetch=async()=>offline?new Response(null,{status:503}):new Response(xml(at))
  try{
    const handler=createNewsHandler({now:()=>clock})
    assert.equal((await handler(request())).headers.get('cache-control'),'public, max-age=0, s-maxage=300, stale-while-revalidate=300')
    clock+=10*60000;offline=true
    const response=await handler(request()),body=await response.json()
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store')
    assert.equal(body.items[0].feedStale,true)
  }finally{globalThis.fetch=original}
})
