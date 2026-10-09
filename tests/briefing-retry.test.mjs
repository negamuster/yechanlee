import test from 'node:test'
import assert from 'node:assert/strict'
import {request} from '../scripts/briefing-gemini.mjs'
const ok=()=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"ok":true}'}]}}]}))
const call=(fetcher,options={})=>request('secret','instruction',{}, {},fetcher,4096,undefined,{sleep:async()=>{},random:()=>0,...options})
test('503/504 retries are bounded and eventually succeed',async()=>{
 let calls=0;const events=[],delays=[]
 assert.deepEqual(await call(async()=>++calls<3?new Response('',{status:calls===1?503:504}):ok(),{sleep:async n=>delays.push(n),onAttempt:e=>events.push(e)}),{ok:true})
 assert.equal(calls,3);assert.deepEqual(delays,[2000,4000]);assert.equal(events[2].result,'success')
 calls=0;await assert.rejects(call(async()=>{calls++;return new Response('secret',{status:503})}),/Gemini HTTP 503/);assert.equal(calls,3)
})
test('network retries, but auth, quota and malformed output never retry or expose response',async()=>{
 let calls=0
 await call(async()=>{if(++calls===1)throw new TypeError('fetch failed: secret');return ok()});assert.equal(calls,2)
 for(const status of [400,401,403,429]) {
  calls=0;await assert.rejects(call(async()=>{calls++;return new Response('secret',{status})}),new RegExp(`^Error: Gemini HTTP ${status}$`));assert.equal(calls,1)
 }
 calls=0;await assert.rejects(call(async()=>{calls++;return new Response('secret')}),/^Error: Gemini response format error$/);assert.equal(calls,1)
})
test('retry deadline prevents another request after budget exhausted',async()=>{
 let clock=0,calls=0
 await assert.rejects(call(async()=>{calls++;clock=149000;return new Response('',{status:503})},{now:()=>clock}),/503/)
 assert.equal(calls,1)
})
test('scheduled request budget permits 15/30 second backoff but still only three attempts',async()=>{
 let calls=0,clock=0;const delays=[]
 await call(async()=>++calls<3?new Response('',{status:503}):ok(),{retryDelays:[15000,30000],totalTimeoutMs:210000,now:()=>clock,sleep:async ms=>{delays.push(ms);clock+=ms}})
 assert.equal(calls,3);assert.deepEqual(delays,[15000,30000])
})
