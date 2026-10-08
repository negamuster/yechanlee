import {load} from 'cheerio'
import {digestHash} from './briefing-articles.mjs'
import {bodyPermission,robotsAllowed,SOURCE_POLICY} from './briefing-source-policy.mjs'
const INDEX='https://www.bea.gov/news/current-releases'
const ua='AnthraciteBriefing/2.0 (+https://yechanlee.vercel.app/)'
const clean=s=>String(s||'').replace(/\s+/g,' ').trim()
async function bounded(url,fetcher,limit=2000000) {
  const r=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{'User-Agent':ua}})
  if(!r.ok)throw Error(`http_${r.status}`)
  const reader=r.body.getReader(),chunks=[];let size=0
  try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('too_large');chunks.push(value)}}finally{await reader.cancel()}
  return Buffer.concat(chunks).toString('utf8')
}
export function releaseIndex(html,cutoff) {
  const $=load(html),seen=new Set()
  return $('tr.release-row').toArray().map(el=>({url:new URL($(el).find('a').first().attr('href')||'/',INDEX).href,title:clean($(el).find('a').first().text()),publishedAt:$(el).find('time').attr('datetime')}))
    .filter(s=>bodyPermission(s.url)==='public-domain-bea'&&s.title&&Number.isFinite(Date.parse(s.publishedAt))&&Date.parse(s.publishedAt)<=cutoff&&cutoff-Date.parse(s.publishedAt)<=14*86400000)
    .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).filter(s=>{if(seen.has(s.url))return false;seen.add(s.url);return true}).slice(0,3)
}
export function extractRelease(html,source,cutoff,at=Date.now()) {
  if(bodyPermission(source.url)!=='public-domain-bea')throw Error('permission_unconfirmed')
  const $=load(html),canonical=$('link[rel="canonical"]').attr('href')
  if(canonical!==source.url)throw Error('release_identity')
  const embargo=clean($('.field--name-field-release-date').first().text())
  const match=embargo.match(/(\d{1,2}):(\d{2})\s*(a\.m\.|p\.m\.)\s*(EDT|EST),\s*\w+,\s*(\w+ \d{1,2}, \d{4})/)
  if(!match)throw Error('release_time')
  const hour=Number(match[1])%12+(match[3]==='p.m.'?12:0)
  const published=Date.parse(`${match[5]} ${hour}:${match[2]}:00 ${match[4]}`)
  if(!Number.isFinite(published)||published>cutoff||cutoff-published>14*86400000||Math.abs(published-Date.parse(source.publishedAt))>60000)throw Error('release_time')
  const root=$('.release-body .field--name-body').first()
  if(!root.length||/all rights reserved|used with permission|copyright [©(]/i.test(root.text()))throw Error('release_rights')
  root.find('script,style,table,figure,figcaption,img,aside,form').remove()
  const unique=[...new Set(root.find('p,li').toArray().map(el=>clean($(el).text())).filter(t=>t.length>=50))]
  if(unique.length<3||unique.join(' ').length<450)throw Error('insufficient_body')
  const texts=[`Source: U.S. Bureau of Economic Analysis. Release date: ${new Date(published).toISOString().slice(0,10)}. Title: ${source.title}.`];let chars=texts[0].length
  for(const text of unique){if(chars+text.length>9000)break;texts.push(text);chars+=text.length}
  if(texts.length<4)throw Error('insufficient_body')
  return {sourceId:source.sourceId,title:source.title,url:source.url,finalUrl:source.url,publishedAt:new Date(published).toISOString(),modifiedAt:null,retrievedAt:new Date(at).toISOString(),kind:'release',scope:'official-release-excerpt',permission:SOURCE_POLICY,bodyHash:digestHash(unique.join('\n')),paragraphs:texts.map((text,i)=>({id:`s${source.sourceId}p${i+1}`,text}))}
}
export async function collectOfficialReleases(original,fetcher=fetch) {
  const base=structuredClone(original),documents=[],unavailable=base.review.inputChecks.filter(c=>c.kind==='feed').map(c=>({sourceId:c.sourceId,reason:'permission_unconfirmed'})),collection=[]
  try {
    // Fail closed on unavailable robots; no alternate-host or redirect bypass.
    const robotTexts=new Map()
    for(const origin of ['https://www.bea.gov'])robotTexts.set(origin,await bounded(origin+'/robots.txt',fetcher,512000))
    if(!robotsAllowed(robotTexts.get('https://www.bea.gov'),INDEX))throw Error('robots_disallowed')
    const sources=releaseIndex(await bounded(INDEX,fetcher),Date.parse(base.cutoffAt))
    for(const s of sources) {
      try {
        if(!robotsAllowed(robotTexts.get('https://www.bea.gov'),s.url))throw Error('robots_disallowed')
        const sourceId=Math.max(0,...base.sources.map(s=>s.id))+1
        const document=extractRelease(await bounded(s.url,fetcher),{...s,sourceId},Date.parse(base.cutoffAt))
        documents.push(document)
        base.sources.push({id:sourceId,label:`BEA · ${s.title} · 발표 ${document.publishedAt.slice(0,10)}`,url:s.url})
        base.review.inputChecks.push({sourceId,verifiedUrl:s.url,checkedAt:document.retrievedAt,publishedAt:document.publishedAt,kind:'data',claimSummary:'Public-domain BEA release text; recent 14-day context, not today’s news'})
        base.review.checkedSources.push(sourceId)
        collection.push({url:s.url,result:'collected'})
      }catch(e){collection.push({url:s.url,result:safeReason(e)})}
    }
    if(!sources.length)collection.push({result:'no_recent_releases'})
  }catch(e){collection.push({result:safeReason(e)})}
  base.review.approvedAt=new Date().toISOString()
  return {base,documents,unavailable,collection}
}
function safeReason(e){return /^(http_\d{3}|too_large|robots_disallowed|permission_unconfirmed|release_identity|release_time|release_rights|insufficient_body)$/.test(e?.message)?e.message:'fetch_failed'}
