import test from 'node:test'
import assert from 'node:assert/strict'
import {bodyPermission,robotsAllowed} from '../scripts/briefing-source-policy.mjs'
import {releaseIndex,extractRelease,collectOfficialReleases} from '../scripts/briefing-official-releases.mjs'
import {researchDigest} from '../scripts/briefing-research.mjs'
import {makeDigest} from '../scripts/briefing-rules.mjs'
import {publishable,contentHash} from '../scripts/briefing-publication.mjs'
const now=Date.parse('2026-10-08T11:00:00Z')
const source=n=>({sourceId:n,url:`https://www.bea.gov/news/2026/release-${n}`,title:`Official release ${n}`,publishedAt:'2026-10-06T12:30:00Z'})
const page=n=>`<link rel="canonical" href="${source(n).url}"><div class="field--name-field-release-date">EMBARGOED UNTIL RELEASE AT 8:30 a.m. EDT, Tuesday, October 6, 2026</div><div class="release-body"><div class="field--name-body">${[1,2,3].map(i=>`<p>In August 2026 the official measure increased 2.2 percent. The previous month was 2.0 percent. This estimate is preliminary and remains subject to revision. Observation group ${i}.</p>`).join('')}</div></div>`
const index=`<table>${[1,2].map(n=>`<tr class="release-row"><td><a href="${source(n).url}">Official release ${n}</a></td><td><time datetime="2026-10-06T08:30:00-04:00"></time></td></tr>`).join('')}</table>`
const base=()=>makeDigest({news:{items:[1,2,3].map(n=>({article_url:`https://www.mk.co.kr/news/economy/${n}`,title:`기업 ${n} 실적 발표`,publisher:n===3?'B':'A',region:'kr',topics:['economy'],published_utc:new Date(now-1000).toISOString()}))},rateRows:[],calendars:[],checkedAt:new Date(now).toISOString()},now,[],now)
test('AI body policy defaults to deny commercial publishers and unapproved hosts',()=>{
 for(const url of ['https://www.mk.co.kr/news/economy/1','https://www.bbc.com/news/1','https://www.cnbc.com/a','https://www.hankyung.com/article/1','http://www.bea.gov/news/2026/a','https://www.bea.gov.evil/news/2026/a'])assert.equal(bodyPermission(url),'permission_unconfirmed')
 assert.equal(bodyPermission(source(1).url),'public-domain-bea')
})
test('robots matches specific groups, wildcards, longest path and allow ties',()=>{
 const rules='User-agent: *\nDisallow: /\nAllow: /news/\nDisallow: /*print*\n'
 assert.equal(robotsAllowed(rules,source(1).url),true)
 assert.equal(robotsAllowed(rules,'https://www.bea.gov/admin/'),false)
 assert.equal(robotsAllowed('User-agent: *\nDisallow: /\nUser-agent: AnthraciteBriefing\nAllow: /news/\n',source(1).url),true)
 assert.equal(robotsAllowed('User-agent: *\nDisallow: /news/\nAllow: /news/\n',source(1).url),true)
 assert.equal(robotsAllowed('User-agent: *\nDisallow: /*.pdf$','https://www.bea.gov/news/a.pdf'),false)
})
test('official releases validate index dates, actual release date, identity and body',()=>{
 assert.equal(releaseIndex(index,now).length,2)
 assert.equal(releaseIndex(index,now+15*86400000).length,0)
 assert.equal(extractRelease(page(1),source(1),now,now).kind,'release')
 assert.throws(()=>extractRelease(page(1),{...source(1),publishedAt:'2026-10-07T12:30:00Z'},now),/release_time/)
 assert.throws(()=>extractRelease(page(1).replace(source(1).url,source(2).url),source(1),now),/identity/)
 assert.throws(()=>extractRelease(page(1).replace('In August','All rights reserved. In August'),source(1),now),/rights/)
})
test('collector honors robots denial and unavailable robots without touching releases',async()=>{
 for(const status of [200,503]) {
  let calls=0
  const result=await collectOfficialReleases(base(),async()=>{calls++;return new Response('User-agent: *\nDisallow: /',{status})})
  assert.equal(calls,1);assert.equal(result.documents.length,0)
  assert.equal(result.collection[0].result,status===200?'robots_disallowed':'http_503')
 }
})
test('official research does not transmit publisher news and records successful diagnostics',async()=>{
 const b=base(),diagnostics={};let modelCalls=0,output,ids
 const item=await researchDigest(b,{apiKey:'test',diagnostics,report:()=>{},fetcher:async(url,options)=>{
  if(url.endsWith('/robots.txt'))return new Response('User-agent: *\nAllow: /')
  if(url.endsWith('/current-releases'))return new Response(index)
  if(url.startsWith('https://www.bea.gov/news/'))return new Response(page(Number(url.slice(-1))))
  assert.ok(url.startsWith('https://generativelanguage.googleapis.com/'))
  const data=JSON.parse(JSON.parse(options.body).contents[0].parts[0].text)
  assert.ok(data.documents.every(d=>!d.url.includes('mk.co.kr')))
  if(++modelCalls===1) {
   ids=data.documents.filter(d=>d.kind==='release').map(d=>d.paragraphs[1].id)
   output={sections:ids.map(id=>({title:'공식 지표의 상승',facts:{text:'공식 지표가 2.2 퍼센트 증가했다.',evidence:[id]},change:null,interpretation:{text:'잠정치이므로 수정 가능성이 있을 수 있다.',evidence:[id]},watch:{text:'다음 수정치에서 변동 여부를 확인한다.',evidence:[id]}}))}
  }
  return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(modelCalls===1?output:{approved:true,issues:[],checkedParagraphIds:ids})}]}}]}))
 }})
 assert.equal(item.review.mode,'gemini-research');assert.equal(diagnostics.attempts.length,2)
 assert.equal(diagnostics.bodyCount,2);assert.equal(diagnostics.fallbackReason,null)
 item.review.execution=diagnostics;item.review.contentHash=contentHash(item)
 assert.equal(publishable([item])[0].reviewMode,'gemini-research')
 assert.ok(item.blocks.some(b=>b.text.includes('최근 14일')))
 assert.ok(item.blocks.some(b=>b.text.includes('기업 1')))
})
test('failed research retains rules and records sanitized category and attempt stage',async()=>{
 const b=base(),diagnostics={}
 const item=await researchDigest(b,{apiKey:'secret',diagnostics,report:()=>{},requestOptions:{sleep:async()=>{}},collector:async()=>({documents:[extractRelease(page(1),source(1),now),extractRelease(page(2),source(2),now)],unavailable:[]}),fetcher:async()=>new Response('secret',{status:503})})
 assert.equal(item,b);assert.equal(diagnostics.attempts.length,3)
 assert.equal(diagnostics.fallbackReason,'Gemini HTTP 503');assert.equal(diagnostics.stage,'generation')
 assert.ok(!JSON.stringify(diagnostics).includes('secret'))
})
