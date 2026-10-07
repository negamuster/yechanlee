import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRates, selectNews, makeDigest } from '../scripts/briefing-rules.mjs'
import { contentHash, publishable } from '../scripts/briefing-publication.mjs'
const now=Date.parse('2026-10-06T22:05:00Z')
const article=(id,pub='A',time=now-1000)=>({article_url:`https://example.com/${id}`,title:`경제 뉴스 ${id}`,publisher:pub,region:'kr',topics:['economy'],published_utc:new Date(time).toISOString()})
const fixture=()=>({news:{items:[article(1),article(2),article(3,'B')]},rateRows:[],treasuryUrl:'https://home.treasury.gov/',calendars:[],checkedAt:new Date(now).toISOString()})
test('selection rejects future, stale, duplicate and already published links',()=>{
 const result=selectNews([article(1),article(1),article(2),article(3,'B',now+1),article(4,'B',now-86400001),article(5,'B')],now,new Set(['https://example.com/2']))
 assert.deepEqual(result.map(x=>x.article_url),['https://example.com/1','https://example.com/5'])
})
test('Treasury columns use explicit maturity; missing values never become zero',()=>{
 const row=(d,value)=>`<tr><td><time datetime="${d}T12:00:00Z"></time></td>${[2,10,30].map(y=>`<td headers="view-field-bc-${y}year-table-column">${value}</td>`).join('')}</tr>`
 const html='Daily Treasury Par Yield Curve Rates'+row('2026-10-05','5.31')+row('2026-10-06','5.27')+row('2026-10-07','5.00')
 assert.equal(parseRates(html,now)[0].rates[10],5.27)
 assert.throws(()=>parseRates('Daily Treasury Par Yield Curve Rates'+row('2026-10-06','N/A'),now))
 assert.throws(()=>parseRates(html,now+10*86400000))
})
test('rules editions are distinctly labeled and cannot claim an AI factual pass',()=>{
 const item=makeDigest(fixture(),now,[],now);item.review.contentHash=contentHash(item)
 assert.equal(publishable([item],now)[0].reviewMode,'rules');assert.equal(item.sessionDate,null)
 item.review.factualReviewPassed=true
 assert.throws(()=>publishable([item],now))
})
test('insufficient news or tampered provenance blocks publication',()=>{
 const input=fixture();input.news.items=[article(1)];assert.throws(()=>makeDigest(input,now))
 const item=makeDigest(fixture(),now,[],now);item.review.contentHash=contentHash(item)
 item.review.inputChecks[0].verifiedUrl='https://example.org/'
 assert.throws(()=>publishable([item],now))
})
test('no events is not presented as an empty official calendar',()=>{
 const item=makeDigest(fixture(),now,[],now)
 assert.ok(item.blocks.some(b=>b.text.includes('일정이 없다는 뜻은 아닙니다')))
})
