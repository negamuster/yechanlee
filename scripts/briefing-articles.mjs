import { load } from 'cheerio'
import { createHash } from 'node:crypto'
export const digestHash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
const adapters = {
  'www.bbc.com': 'article [data-component="text-block"] p, article [data-block="text"] p', 'www.bbc.co.uk': 'article [data-component="text-block"] p, article [data-block="text"] p', 'bbc.com': 'article [data-component="text-block"] p, article [data-block="text"] p',
  'www.cnbc.com': '.ArticleBody-articleBody p',
  'www.mk.co.kr': '.news_cnt_detail_wrap, #article_body',
  'www.hankyung.com': '#articletxt, .article-body',
}
const clean = s => String(s || '').replace(/\s+/g, ' ').trim()
export function allowedArticle(value) {
  try { const u=new URL(value);return u.protocol==='https:' && !u.username && !u.password && !u.port && !!adapters[u.hostname] } catch { return false }
}
async function boundedHTML(url, fetcher) {
  for(let redirects=0;redirects<4;redirects++) {
    if(!allowedArticle(url))throw Error('host_blocked')
    const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'AnthraciteBriefing/2.0 (+https://yechanlee.vercel.app/)','Accept':'text/html'}})
    if([301,302,303,307,308].includes(response.status)) { const target=response.headers.get('location');if(!target)throw Error('redirect_invalid');url=new URL(target,url).href;continue }
    if(!response.ok)throw Error(`http_${response.status}`)
    if(!/text\/html|application\/xhtml\+xml/i.test(response.headers.get('content-type')||''))throw Error('not_html')
    if(Number(response.headers.get('content-length'))>2000000)throw Error('too_large')
    const reader=response.body.getReader(),chunks=[];let bytes=0
    try { while(true) {const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2000000)throw Error('too_large');chunks.push(value)} } finally {await reader.cancel()}
    return {html:Buffer.concat(chunks).toString('utf8'),url}
  }
  throw Error('redirect_limit')
}
function nodes(value) {
  if(Array.isArray(value))return value.flatMap(nodes)
  if(!value || typeof value!=='object')return []
  return [value,...nodes(value['@graph'])]
}
export function extractArticle(html, source, cutoff, finalUrl=source.url) {
  if(!allowedArticle(finalUrl))throw Error('host_blocked')
  const $=load(html)
  const records=$('script[type="application/ld+json"]').toArray().flatMap(el=>{try{return nodes(JSON.parse($(el).text()))}catch{return []}})
  const articles=records.filter(x=>[].concat(x['@type']||[]).some(t=>/^(NewsArticle|Article|ReportageNewsArticle|AnalysisNewsArticle|BlogPosting)$/.test(t)))
  if(articles.some(x=>x.isAccessibleForFree===false || x.isAccessibleForFree==='False' || x.isAccessibleForFree==='false') || $('[class*="paywall"], [id*="paywall"]').toArray().some(el=>/subscribe to (continue|read)|구독.*(읽|열람)|유료.*기사/i.test($(el).text())))throw Error('paywall')
  const metadata=articles[0]||{}
  const date=metadata.datePublished || $('meta[property="article:published_time"]').attr('content') || $('meta[name="date"]').attr('content')
  const modified=metadata.dateModified || $('meta[property="article:modified_time"]').attr('content')
  // Unknown or post-cutoff versions cannot support an as-of briefing.
  if(!date || !/(Z|[+-]\d{2}:?\d{2})$/i.test(date) || !Number.isFinite(Date.parse(date)) || Date.parse(date)>cutoff || cutoff-Date.parse(date)>86400000)throw Error('article_time')
  if(modified && (!/(Z|[+-]\d{2}:?\d{2})$/i.test(modified)||!Number.isFinite(Date.parse(modified))||Date.parse(modified)>cutoff))throw Error('article_updated_after_cutoff')
  if(Math.abs(Date.parse(date)-Date.parse(source.publishedAt))>6*3600000)throw Error('feed_article_time_mismatch')
  const canonical=$('link[rel="canonical"]').attr('href') || $('meta[property="og:url"]').attr('content') || metadata.url
  if(canonical) {const a=new URL(canonical,finalUrl),b=new URL(finalUrl);if(!allowedArticle(a.href)||a.pathname.replace(/\/$/,'')!==b.pathname.replace(/\/$/,''))throw Error('article_identity')}
  $('script,style,nav,aside,footer,form,button,figure,figcaption,[hidden],[aria-hidden="true"],.ad_wrap,.ad,.related,.copyright,.reporter').remove()
  const selector=adapters[new URL(finalUrl).hostname]
  const chunks=$(selector).toArray().flatMap(el=>{
    const node=$(el)
    if(node.is('p'))return [node.text()]
    node.find('br').replaceWith('\n')
    node.find('p').each((_,p)=>$(p).append('\n'))
    return node.text().split(/\n+/)
  }).map(clean).filter(s=>s.length>=45&&!/무단.*(전재|복제)|저작권자|재배포 금지|All rights reserved/i.test(s))
  const unique=[...new Set(chunks)]
  if(unique.length<3 || unique.join(' ').length<450)throw Error('insufficient_body')
  // Full extracted body is not persisted or republished. Bound the model's evidence window.
  const paragraphs=[];let chars=0
  for(const text of unique) {if(chars+text.length>9000)break;paragraphs.push({id:`s${source.sourceId}p${paragraphs.length+1}`,text});chars+=text.length}
  if(paragraphs.length<3)throw Error('insufficient_body')
  return {sourceId:source.sourceId,title:source.title,url:source.url,finalUrl,publishedAt:new Date(Date.parse(date)).toISOString(),modifiedAt:modified?new Date(Date.parse(modified)).toISOString():null,retrievedAt:new Date().toISOString(),kind:'article',scope:paragraphs.length<unique.length?'bounded-body-excerpt':'extracted-body',bodyHash:digestHash(unique.join('\n')),paragraphs}
}
export async function collectArticles(base, fetcher=fetch) {
  const sources=base.review.inputChecks.filter(c=>c.kind==='feed').map(c=>({sourceId:c.sourceId,url:c.verifiedUrl,publishedAt:c.publishedAt,title:base.sources.find(s=>s.id===c.sourceId).label}))
  const documents=[],unavailable=[]
  // Two simultaneous fetches at most; never forward the Gemini key to publishers.
  for(let i=0;i<sources.length;i+=2) {
    const results=await Promise.allSettled(sources.slice(i,i+2).map(async source=>{
      const {html,url}=await boundedHTML(source.url,fetcher)
      return extractArticle(html,source,Date.parse(base.cutoffAt),url)
    }))
    results.forEach((r,j)=>r.status==='fulfilled'?documents.push(r.value):unavailable.push({sourceId:sources[i+j].sourceId,reason:/^(host_blocked|http_\d{3}|not_html|too_large|redirect_limit|redirect_invalid|paywall|article_time|article_updated_after_cutoff|feed_article_time_mismatch|article_identity|insufficient_body)$/.test(r.reason?.message)?r.reason.message:'fetch_failed'}))
  }
  return {documents,unavailable}
}
export function officialDocuments(base) {
  return base.review.inputChecks.filter(c=>c.kind!=='feed').map(c=>{
    const source=base.sources.find(s=>s.id===c.sourceId)
    const text=base.blocks.filter(b=>b.kind==='paragraph'&&b.text.includes(`[${c.sourceId}]`)).map(b=>b.text).join(' ')
    return {sourceId:c.sourceId,title:source.label,url:source.url,finalUrl:source.url,publishedAt:null,modifiedAt:null,retrievedAt:c.checkedAt,kind:c.kind,scope:'official-structured-data',bodyHash:digestHash(text),paragraphs:[{id:`s${c.sourceId}p1`,text}]}
  })
}
