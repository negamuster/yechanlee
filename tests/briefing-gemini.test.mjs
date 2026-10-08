import test from 'node:test'
import assert from 'node:assert/strict'
import { makeDigest } from '../scripts/briefing-rules.mjs'
import { enhanceDigest, attachSummaries, validateSummaries, newsInputs } from '../scripts/briefing-gemini.mjs'
import { contentHash, publishable } from '../scripts/briefing-publication.mjs'
const now=Date.parse('2026-10-08T01:00:00Z')
const base=()=>makeDigest({news:{items:[1,2,3].map(n=>({article_url:`https://example.com/${n}`,title:`기업 실적 증가 ${n}%`,publisher:n===3?'B':'A',region:'kr',topics:['economy'],published_utc:new Date(now-1000).toISOString()}))},rateRows:[],treasuryUrl:'https://home.treasury.gov/',calendars:[],checkedAt:new Date(now).toISOString()},now,[],now)
const entries=b=>newsInputs(b).map(n=>({sourceId:n.sourceId,text:n.title}))
const ok={approved:true,issues:[]}
const reply=value=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]})})
test('Gemini keeps original links/data and has distinct public disclosure',()=>{
 const b=base(),item=attachSummaries(b,entries(b),ok,now)
 item.review.contentHash=contentHash(item)
 assert.equal(publishable([item],now)[0].reviewMode,'gemini')
 assert.deepEqual(item.sources,b.sources)
 assert.ok(item.dataNote.includes('기사 본문 검증이나 시장 원인 분석이 아닙니다'))
 item.blocks[0].text='tampered';item.review.contentHash=contentHash(item)
 assert.throws(()=>publishable([item],now))
})
test('unknown/duplicate citations, new numbers and rejected comparison are blocked',()=>{
 const b=base(),e=entries(b),inputs=newsInputs(b)
 assert.throws(()=>validateSummaries([{...e[0],sourceId:999},...e.slice(1)],inputs))
 assert.throws(()=>validateSummaries([e[0],e[0],e[2]],inputs))
 assert.throws(()=>validateSummaries([{...e[0],text:'기업 실적 99% 증가'},...e.slice(1)],inputs))
 assert.throws(()=>attachSummaries(b,e,{approved:false,issues:['unsupported']},now))
})
test('missing key, quota error, invalid JSON and failed comparison preserve exact fallback',async()=>{
 const b=base()
 assert.equal(await enhanceDigest(b,{apiKey:'',report:()=>{}}),b)
 for(const fetcher of [async()=>({ok:false,status:429}),async()=>reply({}).json().then(()=>({ok:true,json:async()=>({})})),async()=>{throw Error('secret-not-for-logs')}]) {
  const logs=[]
  assert.equal(await enhanceDigest(b,{apiKey:'secret-not-for-logs',fetcher,report:x=>logs.push(x)}),b)
  assert.ok(logs.every(x=>!x.includes('secret-not-for-logs')))
 }
 let calls=0
 assert.equal(await enhanceDigest(b,{apiKey:'test',fetcher:async()=>reply(++calls===1?{summaries:entries(b)}:{approved:false,issues:['unsupported']}),report:()=>{}}),b)
 assert.equal(calls,2)
})
test('successful flow makes only two calls, sends secret in header and has no tools',async()=>{
 const b=base();let calls=0
 const item=await enhanceDigest(b,{apiKey:'test-key',report:()=>{},fetcher:async(url,opts)=>{
  assert.ok(!url.includes('test-key'));assert.equal(opts.headers['x-goog-api-key'],'test-key')
  assert.equal(JSON.parse(opts.body).tools,undefined)
  return reply(++calls===1?{summaries:entries(b)}:ok)
 }})
 assert.equal(calls,2);assert.equal(item.review.mode,'gemini');assert.equal(b.review.mode,'rules')
})
