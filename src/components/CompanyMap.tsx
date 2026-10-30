import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { useSessionState } from '../hooks/useSessionState'
import { refreshPolicies } from '../lib/refreshPolicy'
import { mapSectors, validCompanyMap, marketMapLayout, mapCap, mapChange, mapTime } from '../lib/companyMap'
import ResourceState from './ResourceState'
import WidgetActions from './WidgetActions'
import './CompanyMap.css'
function Logo({ symbol }: { symbol: string }) {
  const [failed,setFailed]=useState(false)
  const available=['NVDA','AAPL','GOOGL','AMZN','TSM'].includes(symbol)
  return <span className="company-map-logo" aria-hidden="true">{failed||!available ? symbol.slice(0,2) : <img src={`/company-logos/${symbol}.svg`} alt="" loading="lazy" onError={()=>setFailed(true)} />}</span>
}
export default function CompanyMap({compact=false, controls}: {compact?:boolean;controls?:ReactNode}) {
  const [sector,setSector]=useSessionState<string>('maps.company.sector','all',v=>v==='all'||mapSectors.some(([key])=>key===v))
  const [count,setCount]=useSessionState<number>('maps.company.count',compact?15:30,v=>[15,30,50].includes(v as number))
  const [view,setView]=useSessionState<string>('maps.company.display','map',v=>v==='map'||v==='list')
  const [revision,setRevision]=useState(0), [info,setInfo]=useState(false)
  const infoId=useId(), titleId=useId()
  const {data,loading,error}=useResource('/api/sector-performance?view=companies',validCompanyMap,refreshPolicies.maps,revision)
  const container=useRef<HTMLDivElement>(null)
  const [width,setWidth]=useState(0)
  useEffect(()=>{
    const element=container.current
    if(!element)return
    const update=()=>setWidth(element.clientWidth)
    update();const observer=new ResizeObserver(update);observer.observe(element);return ()=>observer.disconnect()
  },[view,data])
  const height=compact?460:560
  const rows=(data?.companies??[]).filter(c=>sector==='all'||c.sector===sector).sort((a,b)=>b.marketCap-a.marketCap||a.symbol.localeCompare(b.symbol)).slice(0,count)
  const rects=marketMapLayout(rows,width,height)
  const [clock,setClock]=useState(Date.now)
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),60000);return ()=>clearInterval(timer)},[])
  const oldQuote=!!data?.companies.some(c=>clock-Date.parse(c.quoteAt)>5*86400000)
  return <section className={`company-map${compact?' is-compact':''}`} aria-labelledby={titleId}>
    <div className="widget-heading"><h2 id={titleId} className="widget-title">{compact?<Link to="/equity" data-widget-link aria-label="Maps 기업별 시가총액 지도 보기">Maps</Link>:'Maps · 기업별 시가총액'}</h2><WidgetActions label="Maps" refresh={{loading,onClick:()=>setRevision(n=>n+1)}} info={{id:infoId,label:'Maps 출처와 산정 기준',open:info,disabled:!data,onClick:()=>setInfo(v=>!v)}} /></div>
    <div id={infoId} className="widget-info-panel" data-widget-interactive hidden={!info}>
      <p>면적은 USD 기업 시가총액 추정치, 색상은 정규장 시세의 전일 종가 대비 등락률입니다. 실시간 시황이 아닙니다. ADR은 공급자가 제공하는 기업 전체 시가총액 기준입니다.</p>
      <p>Yahoo Finance 시총 상위 {data?.sourceCount??100}개 원본 중 NYSE·Nasdaq 주식·중복 제거 후 {data?.companies.length??'—'}개 기업. 시장 전체나 특정 지수의 구성 종목 전체가 아닙니다. 업종은 자체 사업 분류이며 해당 업종 전체 순위가 아닙니다.</p>
      <p>시가총액은 수집 시점 공급자 값이며 별도 산정 시각은 미제공입니다. 종목별 정규장 시세 시각은 타일 상세/목록에 표시합니다. 업종 분류 확인 {data?.classificationAt??'—'}.</p>
      <a href="https://finance.yahoo.com/research-hub/screener/largest_market_cap/" target="_blank" rel="noopener noreferrer">Yahoo Finance 원본 ↗</a>
    </div>
    {controls}
    <div className="company-map-controls" data-widget-interactive>
      <label><span className="sr-only">Maps 보기 기준</span><select aria-label="Maps 보기 기준" value={sector} onChange={e=>setSector(e.target.value)}><option value="all">시가총액 순 · 전체</option>{mapSectors.map(([key,label])=><option key={key} value={key}>{label} · 시가총액 순</option>)}</select></label>
      <label><span className="sr-only">Maps 표시 종목 수</span><select aria-label="Maps 표시 종목 수" value={count} onChange={e=>setCount(Number(e.target.value))}>{[15,30,50].map(n=><option key={n} value={n}>Top {n}</option>)}</select></label>
      <button type="button" aria-pressed={view==='list'} onClick={()=>setView(v=>v==='map'?'list':'map')}>{view==='map'?'목록 보기':'지도 보기'}</button>
    </div>
    <ResourceState label="기업 지도" loading={loading} error={error} hasData={!!data} stale={data?.stale} updatedAt={data?.fetchedAt} onRetry={()=>setRevision(n=>n+1)} layout="tiles" />
    {data&&<>
      {(data.sourceError||data.stale)&&<p className="company-map-warning" role="status">원본 갱신 실패 · 이전 수집 자료입니다. 수집 시각 {mapTime(data.fetchedAt)}</p>}
      {oldQuote&&<p className="company-map-warning">5일 이상 지난 시세가 포함되어 있습니다. 종목별 시각을 확인하세요.</p>}
      <p className="company-map-basis">면적: 시가총액 · 색상: 정규장 등락률<br/>수집 범위 {data.companies.length}개 중 {sector==='all'?'전체':mapSectors.find(([k])=>k===sector)?.[1]} {rows.length}개</p>
      {view==='map'?<div className="company-map-canvas" ref={container} style={{height}} aria-label="시가총액 비례 기업 지도">
        {rects.map(({company:c,x,y,width:w,height:h},index)=>{
          const small=w<60||h<50, large=w>=90&&h>=90
          const tone=c.changePercent===null||c.changePercent===0?'flat':c.changePercent>0?'up':'down'
          const detail=`${c.name} (${c.symbol}) · 시총 ${mapCap(c.marketCap)} · ${mapChange(c.changePercent)} · 정규장 시세 ${mapTime(c.quoteAt)}`
          return <Link key={c.symbol} className={`company-map-tile is-${tone}${small?' is-small':''}`} style={{left:x,top:y,width:w,height:h}} to={`/stock/${encodeURIComponent(c.symbol.replace('-', '.'))}`} title={detail} aria-label={detail}>
            {large&&index<8&&<Logo symbol={c.symbol} />}
            <strong>{c.symbol}</strong>{large&&<span className="company-map-name">{c.name}</span>}{!small&&<span>{mapChange(c.changePercent)}</span>}
          </Link>
        })}
        {!rows.length&&<p className="company-map-empty">현재 수집 범위에 이 업종 기업이 없습니다. 전체 또는 다른 업종을 선택하세요.</p>}
      </div>:<div className="company-map-list" aria-label="기업 시가총액 목록">{rows.length?rows.map(c=><Link key={c.symbol} to={`/stock/${encodeURIComponent(c.symbol.replace('-', '.'))}`}><strong>{c.symbol} · {c.name}</strong><span>{mapCap(c.marketCap)} · {mapChange(c.changePercent)}</span><small>정규장 시세 {mapTime(c.quoteAt)}</small></Link>):<p>현재 수집 범위에 이 업종 기업이 없습니다.</p>}</div>}
      <div className="company-map-legend"><span className="is-down">하락 −</span><span>보합/미제공</span><span className="is-up">상승 +</span></div>
      <p className="company-map-receipt">Yahoo Finance · 수집 {mapTime(data.fetchedAt)}<br/>지연 시세 포함 · 작은 타일은 목록 보기에서 확인</p>
    </>}
  </section>
}
