import test from 'node:test'
import assert from 'node:assert/strict'
import {makeDigest,selectNews} from '../scripts/briefing-rules.mjs'
import {extractArticle,collectArticles,officialDocuments,digestHash} from '../scripts/briefing-articles.mjs'
import {attachResearch,evidenceNumbers,evidenceCatalog,validateResearchOutput,researchDigest} from '../scripts/briefing-research.mjs'
import {contentHash,publishable} from '../scripts/briefing-publication.mjs'
const now=Date.parse('2026-10-08T05:00:00Z')
const base=()=>makeDigest({news:{items:[1,2,3].map(n=>({article_url:`https://www.mk.co.kr/news/economy/${n}`,title:`기업 ${n} 실적 발표`,publisher:n===3?'B':'A',region:'kr',topics:['economy'],published_utc:new Date(now-1000).toISOString()}))},rateRows:[{date:'2026-10-07',rates:{2:4,10:5,30:6}}],treasuryUrl:'https://home.treasury.gov/',calendars:[],checkedAt:new Date(now).toISOString()},now,[],now)
const docs=b=>b.review.inputChecks.filter(c=>c.kind==='feed').slice(0,2).map(c=>({sourceId:c.sourceId,title:'기업 실적',url:c.verifiedUrl,finalUrl:c.verifiedUrl,publishedAt:c.publishedAt,modifiedAt:null,retrievedAt:new Date(now).toISOString(),kind:'article',scope:'extracted-body',bodyHash:digestHash('body'),paragraphs:[{id:`s${c.sourceId}p1`,text:'회사는 매출이 10% 증가했다고 밝혔다. 비용 부담은 지속되었고 다음 분기 수요는 불확실하다고 설명했다.'}]}))
const output=ds=>({sections:ds.map(d=>({title:'매출 증가와 비용 부담',facts:{text:'회사는 매출이 10% 증가했다고 밝혔다.',evidence:[d.paragraphs[0].id]},change:null,interpretation:{text:'비용 부담에 따라 수익성 개선은 제한될 수 있다.',evidence:[d.paragraphs[0].id]},watch:{text:'다음 분기 수요가 개선되는지 확인할 필요가 있다.',evidence:[d.paragraphs[0].id]}}))})
const verdict=o=>({approved:true,issues:[],checkedParagraphIds:[...new Set(o.sections.flatMap(s=>s.facts.evidence))]})
test('research publication retains official figures, source links, explicit inference and no raw body',()=>{
 const b=base(),ds=docs(b),o=output(ds),catalog=evidenceCatalog([...ds,...officialDocuments(b)])
 const item=attachResearch(b,o,catalog,verdict(o),[],now);item.review.contentHash=contentHash(item)
 const pub=publishable([item],now)[0]
 assert.equal(pub.reviewMode,'gemini-research');assert.equal(pub.review,undefined)
 assert.ok(item.blocks.some(x=>x.text.includes('2년물 4.00%')))
 assert.ok(item.blocks.some(x=>x.text.startsWith('Gemini 해석:')))
 assert.ok(item.blocks.some(x=>x.text.includes('이전 상태를 확인하지 못했습니다')))
 assert.ok(!JSON.stringify(item.review.catalog).includes(ds[0].paragraphs[0].text))
 item.blocks[0].text='tampered';item.review.contentHash=contentHash(item)
 assert.throws(()=>publishable([item],now))
})
test('unsupported numbers, nonexistent evidence, missing fields and incomplete review are rejected',()=>{
 const b=base(),ds=docs(b),cat=evidenceCatalog(ds),o=output(ds)
 const altered=structuredClone(o);altered.sections[0].facts.text='매출이 99% 증가했다고 밝혔다.'
 assert.throws(()=>validateResearchOutput(altered,cat))
 altered.sections[0].facts.evidence=['s999p1'];assert.throws(()=>validateResearchOutput(altered,cat))
 assert.throws(()=>attachResearch(b,o,cat,{...verdict(o),checkedParagraphIds:[]},[],now))
 const missing=structuredClone(o);delete missing.sections[0].change;assert.throws(()=>validateResearchOutput(missing,cat))
})
const paragraph='공개된 기업 자료는 실적 증가와 비용 구조의 변화를 설명한다. 연구개발과 설비투자가 이어졌으며 앞으로 수요를 확인할 필요가 있다고 회사는 설명했다. '
const source={sourceId:2,title:'기사',url:'https://www.mk.co.kr/news/economy/1',publishedAt:'2026-10-08T04:00:00Z'}
const html=(extra={},body=[1,2,3,4].map(n=>`<p>${paragraph.repeat(2)} 문단 ${n}</p>`).join(''))=>`<html><head><link rel="canonical" href="${source.url}"><script type="application/ld+json">${JSON.stringify({'@type':'NewsArticle',datePublished:source.publishedAt,...extra})}</script></head><body><div class="news_cnt_detail_wrap">${body}</div></body></html>`
test('extractor rejects paywalls, future revisions, missing times and headline-only pages',()=>{
 const article=extractArticle(html(),source,now)
 assert.equal(article.paragraphs.length,4)
 assert.throws(()=>extractArticle(html({isAccessibleForFree:false}),source,now),/paywall/)
 assert.throws(()=>extractArticle(html({dateModified:'2026-10-08T05:01:00Z'}),source,now),/cutoff/)
 assert.throws(()=>extractArticle(html({datePublished:null}),source,now),/article_time/)
 assert.throws(()=>extractArticle(html({},'<p>본문 없음</p>'),source,now),/insufficient/)
 assert.throws(()=>extractArticle(html().replace(source.url,'https://www.mk.co.kr/news/economy/other'),source,now),/identity/)
})
test('article fetch refuses external redirect and oversized streams',async()=>{
 const b=base();let calls=0
 const r=await collectArticles(b,async()=>{calls++;return new Response(null,{status:302,headers:{location:'http://127.0.0.1/'}})})
 assert.equal(calls,3);assert.equal(r.documents.length,0);assert.ok(r.unavailable.every(x=>x.reason==='host_blocked'))
 const large=await collectArticles(b,async()=>new Response('x'.repeat(2000001),{headers:{'content-type':'text/html'}}))
 assert.ok(large.unavailable.every(x=>x.reason==='too_large'))
})
test('insufficient bodies and quota failures preserve exact rules base; never call model for unavailable bodies',async()=>{
 const b=base();let calls=0
 assert.equal(await researchDigest(b,{apiKey:'test',collector:async()=>({documents:[],unavailable:[]}),fetcher:async()=>{calls++},report:()=>{}}),b)
 assert.equal(calls,0)
 assert.equal(await researchDigest(b,{apiKey:'test',collector:async()=>({documents:docs(b),unavailable:[]}),fetcher:async()=>({ok:false,status:429}),report:()=>{}}),b)
})
test('two-call research flow includes body paragraphs and pins no external tools',async()=>{
 const b=base(),ds=docs(b),o=output(ds);let calls=0
 const item=await researchDigest(b,{apiKey:'test',collector:async()=>({documents:ds,unavailable:[]}),report:()=>{},fetcher:async(url,opts)=>{
  const request=JSON.parse(opts.body);assert.equal(request.tools,undefined)
  assert.ok(request.contents[0].parts[0].text.includes(ds[0].paragraphs[0].text))
  return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(++calls===1?o:verdict(o))}]}}]})}
 }})
 assert.equal(calls,2);assert.equal(item.review.mode,'gemini-research')
})
test('stock promotion headlines are excluded from briefing selection',()=>{
 assert.equal(selectNews([{title:'MK시그널 추천주',article_url:'https://www.mk.co.kr/a',published_utc:new Date(now).toISOString(),publisher:'MK'}],now).length,0)
})

test('date translation permits English months and zero padding, without financial number conversion',()=>{
 assert.ok(evidenceNumbers('Released 2026-10-06. August rose from July.').includes('6'))
 assert.ok(evidenceNumbers('August rose from July.').includes('8'))
 assert.ok(evidenceNumbers('August rose from July.').includes('7'))
 assert.ok(evidenceNumbers('the second quarter, third estimate').includes('2'))
 assert.ok(!evidenceNumbers('Revenue was $105.6 billion.').includes('1056'))
 assert.ok(!evidenceNumbers('Revenue was $105.6 billion.').includes('8'))
 const ds=docs(base());ds.forEach(d=>d.paragraphs[0].text='In August 2026, revenue increased 10% from July. Release date 2026-10-06.')
 const o=output(ds);o.sections.forEach(s=>s.facts.text='8월 매출이 7월보다 10% 증가했다. 발표일은 10월 6일이다.')
 assert.doesNotThrow(()=>validateResearchOutput(o,evidenceCatalog(ds)))
 o.sections[0].facts.text='매출은 1056억 달러였다.'
 assert.throws(()=>validateResearchOutput(o,evidenceCatalog(ds)),/research_number/)
})

test('one rejected audit can be corrected, but corrected draft requires a new passing audit',async()=>{
 const b=base(),ds=docs(b),o=output(ds),diagnostics={};let calls=0
 const item=await researchDigest(b,{apiKey:'test',diagnostics,collector:async()=>({documents:ds,unavailable:[]}),report:()=>{},fetcher:async(url,opts)=>{
  const data=JSON.parse(JSON.parse(opts.body).contents[0].parts[0].text)
  calls++
  if(calls===3){assert.equal(data.rejectedClaims[0].claimId,'section-1.facts')}
  const answer=calls===1?o:calls===3?{patches:[{claimId:'section-1.facts',replacement:o.sections[0].facts}]}:calls===2?{approved:false,issues:[{claimId:'section-1.facts',category:'attribution',reason:'Check attribution.',evidence:o.sections[0].facts.evidence}],checkedParagraphIds:verdict(o).checkedParagraphIds}:verdict(o)
  return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(answer)}]}}]}))
 }})
 assert.equal(calls,4);assert.equal(item.review.mode,'gemini-research');assert.equal(diagnostics.corrections,1)
 assert.equal(diagnostics.comparisons[0].approved,false);assert.equal(diagnostics.comparisons[1].approved,true)
 calls=0
 const rejected=await researchDigest(b,{apiKey:'test',collector:async()=>({documents:ds,unavailable:[]}),report:()=>{},fetcher:async()=>{
  calls++;const answer=calls===1?o:calls===3?{patches:[{claimId:'section-1.facts',replacement:o.sections[0].facts}]}:{approved:false,issues:[{claimId:'section-1.facts',category:'attribution',reason:'Unsupported attribution.',evidence:o.sections[0].facts.evidence}],checkedParagraphIds:verdict(o).checkedParagraphIds}
  return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(answer)}]}}]}))
 }})
 assert.equal(calls,4);assert.equal(rejected,b)
})

test('billion and trillion dollar mistranslations fail the deterministic unit gate',()=>{
 const ds=docs(base());ds[0].paragraphs[0].text='Revenue increased 10% to $105.6 billion. The prior amount was $92.8 billion.'
 const o=output(ds);o.sections[0].facts.text='매출은 105.6억 달러였다.'
 assert.throws(()=>validateResearchOutput(o,evidenceCatalog(ds)),/research_unit/)
 o.sections[0].facts.text='매출은 105.6 billion USD였다.'
 assert.doesNotThrow(()=>validateResearchOutput(o,evidenceCatalog(ds)))
})
