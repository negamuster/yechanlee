import { createHash } from 'node:crypto'
import { collectNews, SOURCES as NEWS } from '../lib/news.js'
import { SOURCES, parseICS, parseFed, dateInNY, validDate, zonedISO } from '../lib/calendar.js'
const DAY = 86400000
export const kstDate = n => new Date(n + 9 * 3600000).toISOString().slice(0, 10)
const kst = n => new Intl.DateTimeFormat('ko-KR', { timeZone:'Asia/Seoul', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(new Date(n)) + ' KST'
const plain = s => String(s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
const hash = s => createHash('sha256').update(s).digest('hex')
export async function download(url, fetcher = fetch) {
  const r = await fetcher(url, { signal:AbortSignal.timeout(25000), headers:{'User-Agent':'AnthraciteDigest/1.0 (+https://yechanlee.vercel.app/)'} })
  if (!r.ok) throw Error(`HTTP ${r.status}`)
  const s = await r.text()
  if (s.length > 4000000) throw Error('Response too large')
  return s
}
export function parseRates(html, cutoff) {
  if (!html.includes('Daily Treasury Par Yield Curve Rates')) throw Error('Unexpected Treasury table')
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap(([, row]) => {
    const m = row.match(/<time[^>]*datetime="(\d{4}-\d{2}-\d{2})T/)
    if (!m || !validDate(m[1]) || Date.parse(zonedISO(m[1],18,0)) > cutoff) return [] // conservative availability bound: 18:00 New York
    const rates = {}
    for (const years of [2,10,30]) {
      const cells = [...row.matchAll(new RegExp(`<td[^>]*headers="view-field-bc-${years}year-table-column"[^>]*>([\\s\\S]*?)<\\/td>`, 'g'))]
      const s = cells.length === 1 ? plain(cells[0][1]) : ''
      if (!/^\d{1,2}(\.\d{1,3})?$/.test(s) || Number(s) > 30) return []
      rates[years] = Number(s)
    }
    return [{date:m[1], rates}]
  }).sort((a,b)=>b.date.localeCompare(a.date))
  if (!rows.length || cutoff-Date.parse(rows[0].date+'T12:00:00Z') > 7*DAY) throw Error('Missing or stale Treasury data')
  if (new Set(rows.map(r=>r.date)).size !== rows.length) throw Error('Duplicate Treasury dates')
  return rows.slice(0,2)
}
export function selectNews(items, cutoff, seen = new Set()) {
  const urls = new Set(seen), titles = new Set(), counts = new Map()
  return items.filter(x => Date.parse(x.published_utc) <= cutoff && Date.parse(x.published_utc) > cutoff-DAY && /^https:\/\//.test(x.article_url))
    .sort((a,b)=>Number(b.region==='kr')-Number(a.region==='kr') || Date.parse(b.published_utc)-Date.parse(a.published_utc))
    .filter(x=>{
      const key=x.title.toLowerCase().replace(/[\p{P}\p{S}\s]/gu,'')
      if(urls.has(x.article_url)||titles.has(key)||(counts.get(x.publisher)||0)>=2)return false
      urls.add(x.article_url); titles.add(key); counts.set(x.publisher,(counts.get(x.publisher)||0)+1); return true
    }).slice(0,8)
}
export async function collectInputs(cutoff, fetcher=fetch) {
  const year=Number(dateInNY(cutoff).slice(0,4))
  const treasuryUrl=`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value=${year}`
  const selected=NEWS.filter(s=>['bbc-business','cnbc-finance','mk-economy','mk-stocks','hankyung-economy'].includes(s.id))
  const jobs=[collectNews(fetcher,selected,cutoff,25000),download(treasuryUrl,fetcher), ...['fed','bls','bea'].map(s=>download(SOURCES[s].url,fetcher))]
  const results=await Promise.allSettled(jobs), checkedAt=new Date().toISOString()
  const news=results[0].status==='fulfilled'?results[0].value:{items:[],sources:[]}
  let rateRows=[], rateError=null
  try {
    if(results[1].status!=='fulfilled')throw results[1].reason
    let html=results[1].value
    // The first days of January may require the preceding year's last observations.
    if(dateInNY(cutoff).slice(5,7)==='01')html += await download(treasuryUrl.replace(`=${year}`,`=${year-1}`),fetcher)
    rateRows=parseRates(html,cutoff)
  } catch(e){rateError=e.message}
  const calendars=['fed','bls','bea'].map((key,i)=>{
    try {
      if(results[i+2].status!=='fulfilled')throw results[i+2].reason
      const raw=results[i+2].value
      if(key!=='fed' && !raw.includes('END:VCALENDAR'))throw Error('Invalid calendar')
      return {key,url:SOURCES[key].url,checkedAt,events:key==='fed'?parseFed(JSON.parse(raw)):parseICS(raw,key)}
    }catch(e){return {key,url:SOURCES[key].url,error:e.message,events:[]}}
  })
  return {news,rateRows,treasuryUrl,rateError,calendars,checkedAt}
}
export function makeDigest(input, cutoff, previous=[], published=Date.now()) {
  const seen=new Set(previous.filter(x=>['rules','gemini'].includes(x.review?.mode)).flatMap(x=>x.sources.map(s=>s.url)))
  const news=selectNews(input.news.items,cutoff,seen)
  if(news.length<3 || new Set(news.map(n=>n.publisher)).size<2)throw Error('Withheld: fewer than 3 fresh headlines from 2 publishers')
  const sources=[],checks=[],blocks=[]
  const source=(label,url,publishedAt,kind,claim)=>{
    const id=sources.length+1; sources.push({id,label,url});checks.push({sourceId:id,verifiedUrl:url,checkedAt:input.checkedAt,publishedAt,kind,claimSummary:claim});return id
  }
  const block=(kind,text)=>blocks.push({kind,text})
  const summary=[`최근 24시간 경제·기업 뉴스 ${news.length}건을 매체별 최대 2건씩 정리했습니다. 한국어 제목을 우선하고 같은 언어 안에서는 최신순으로 표시합니다.`]
  block('paragraph',`수집 범위: ${kst(cutoff-DAY)}~${kst(cutoff)}. 기사 제목과 발표 데이터를 정해진 규칙으로 정리한 브리핑입니다. 기사 본문을 읽거나 사실관계·시장 원인을 별도로 분석한 결과는 아닙니다.`)
  block('heading','1. 공식 금리 데이터')
  if(input.rateRows.length){
    const [latest,prior]=input.rateRows
    const id=source('미국 재무부 · 일별 파 수익률',input.treasuryUrl,null,'data',`${latest.date} 2·10·30년 파 수익률 및 직전 관측일 비교`)
    const text=[2,10,30].map(y=>{
      const bp=prior?Math.round((latest.rates[y]-prior.rates[y])*100):null
      return `${y}년물 ${latest.rates[y].toFixed(2)}%${bp===null?'':bp===0?' (변동 없음)':` (${Math.abs(bp)}bp ${bp>0?'상승':'하락'})`}`
    }).join(' · ')
    block('paragraph',`${latest.date} 기준: ${text}.[${id}]`)
    block('metadata',`미국 재무부 파 수익률 · ${prior?`비교일 ${prior.date} → ${latest.date}`:'비교값 미확보'} · 주식 거래일·시장 호가와 구분`)
    summary.push(`미국 재무부 ${latest.date} 자료에서 10년물 파 수익률은 ${latest.rates[10].toFixed(2)}%입니다.[${id}]`)
  }else block('paragraph','이번 실행에서 신선도·형식 검사를 통과한 금리 자료를 확보하지 못했습니다. 이전 수치를 오늘 자료로 표시하지 않습니다.')
  block('heading','2. 경제·기업 뉴스 제목')
  const topics={economy:'경제',tech:'기술·반도체',investing:'시장·투자',business:'기업'}
  for(const n of news){
    const id=source(`${n.publisher} · ${n.title}`,n.article_url,n.published_utc,'feed','발행사 RSS의 제목·링크·발행시각만 수집; 본문 사실검증 아님')
    block('subheading',`${n.title.replace(/\[(\d+)\]/g,'($1)')} [${id}]`)
    block('metadata',`${n.publisher} · ${kst(Date.parse(n.published_utc))} · ${topics[n.topics[0]]||'경제·기업'} · ${n.region==='kr'?'원문 제목':'영문 원문 제목 · 번역 없음'}`)
  }
  block('heading','3. 향후 72시간 공식 일정')
  const events=input.calendars.flatMap(c=>c.events.map(e=>({...e,calendar:c}))).filter(e=>e.startAt&&Date.parse(e.startAt)>cutoff&&Date.parse(e.startAt)<=cutoff+3*DAY)
    .sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)).slice(0,3)
  for(const e of events){
    const id=source(`${e.source} · 공식 일정`,e.calendar.url,null,'calendar','공식 피드의 예정시각을 KST로 변환; 일정은 변경 가능')
    block('paragraph',`${kst(Date.parse(e.startAt))} · ${e.title} [${id}]`)
  }
  if(!events.length)block('paragraph','조회에 성공한 공식 달력에서 향후 72시간 내 시각이 명시된 일정을 확보하지 못했습니다. 일정이 없다는 뜻은 아닙니다.')
  const failed=input.calendars.filter(c=>c.error).map(c=>SOURCES[c.key].name)
  if(failed.length)block('metadata',`일정 수집 불가: ${failed.join(', ')}`)
  summary.push('뉴스 제목의 원문 링크와 시간순 공식 일정은 전체 브리핑에서 확인할 수 있습니다. 별도의 시장 해석이나 투자 의견은 포함하지 않습니다.')
  return {id:kstDate(cutoff),status:'published',title:`${kstDate(cutoff)} 경제·기업 뉴스와 공식 지표`,sessionDate:null,cutoffAt:new Date(cutoff).toISOString(),publishedAt:new Date(published).toISOString(),summary,blocks,sources,dataNote:'규칙 기반 자동 정리 · AI 미사용. 뉴스는 RSS 원문 제목·링크만 제공하며 별도 본문 검증·번역·요약을 하지 않습니다. 공식 데이터는 날짜·형식·수치 범위를 검사합니다. 일부 출처 수집 실패로 누락될 수 있습니다. 실시간 시황이나 포괄적인 시장 결산이 아닙니다.',corrections:[],review:{mode:'rules',approvedBy:'Anthracite deterministic publisher',approvedAt:new Date(published).toISOString(),checkedSources:sources.map(s=>s.id),inputChecks:checks,inputHash:hash(JSON.stringify({news:news.map(n=>n.article_url),rates:input.rateRows,events:events.map(e=>e.id)})),generatorVersion:1}}
}
export function validateRules(item){
  if(item.review?.mode!=='rules')return
  const r=item.review
  if(r.approvedBy!=='Anthracite deterministic publisher'||r.generatorVersion!==1||r.factualReviewPassed!==undefined||!Array.isArray(r.inputChecks)||!r.inputHash)throw Error('Invalid rules publisher')
  const ids=new Set()
  for(const c of r.inputChecks){
    const s=item.sources.find(s=>s.id===c.sourceId), at=Date.parse(c.checkedAt)
    if(!s||s.url!==c.verifiedUrl||ids.has(c.sourceId)||!Number.isFinite(at)||at>Date.parse(r.approvedAt)||!['data','feed','calendar'].includes(c.kind)||!c.claimSummary)throw Error('Invalid rules evidence')
    if(c.publishedAt!==null&&(!Number.isFinite(Date.parse(c.publishedAt))||Date.parse(c.publishedAt)>Date.parse(item.cutoffAt)))throw Error('Future rules source')
    ids.add(c.sourceId)
  }
  if(item.sources.some(s=>!ids.has(s.id)))throw Error('Missing rules evidence')
  for(const t of [...item.summary,...item.blocks.map(b=>b.text)])for(const m of t.matchAll(/\[(\d+)\]/g))if(!ids.has(Number(m[1])))throw Error('Unknown rules citation')
}
