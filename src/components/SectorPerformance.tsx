import type { ReactNode } from 'react'
import CompanyMap from './CompanyMap'
import { refreshPolicies } from '../lib/refreshPolicy'
import type { NewsSector } from './sectorNews'
import { useResource } from '../hooks/useResource'
import { useSessionState } from '../hooks/useSessionState'
import DataStatus from './DataStatus'
import ResourceState from './ResourceState'
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import WidgetActions from './WidgetActions'
import SelectionButton from './SelectionButton'
import './SectorPerformance.css'
const periods = [['1d', '1일'], ['1w', '1주'], ['1m', '1개월'], ['ytd', '연초 이후']] as const
type Period = typeof periods[number][0]
type Row = { symbol: string; name: string; returns: Record<Period, number | null>; relative: Record<Period, number | null>; starts: Record<Period, string | null>; asOf: string | null }
type Data = { sectors: Row[]; benchmark: Row; fetchedAt: string; stale: boolean; basis: string }
const format = (v: number | null | undefined, unit = '%') => v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}${unit}`
const tone = (v: number | null) => v == null || v === 0 ? 'flat' : v > 0 ? 'positive' : 'negative'
function validData(value: unknown): value is Data {
  const data = value as Data | null
  return !!data && Array.isArray(data.sectors) && !!data.benchmark && !!data.benchmark.returns
}
type Props = { compact?: boolean; selectedSector?: string; onSelectSector?: (sector: NewsSector) => void }
export default function SectorPerformance(props: Props) {
  const [view,setView]=useSessionState('maps.view','companies',v=>v==='companies'||v==='etf')
  const controls=<div className="maps-view-tabs" role="group" aria-label="Maps 대상 선택" data-widget-interactive><button type="button" aria-pressed={view==='companies'} onClick={()=>setView('companies')}>기업 시가총액</button><button type="button" aria-pressed={view==='etf'} onClick={()=>setView('etf')}>업종 ETF</button></div>
  return view==='companies'?<CompanyMap compact={props.compact} controls={controls}/>:<SectorETF {...props} controls={controls}/>
}
export function SectorETF({ compact = false, selectedSector, onSelectSector, controls }: Props & {controls?:ReactNode}) {
  const [period, setPeriod] = useSessionState<Period>('maps.period', '1d', v => periods.some(([period]) => period === v))
  const [infoOpen, setInfoOpen] = useState(false)
  const infoId = useId()
  const [relative, setRelative] = useSessionState('maps.relative', false, v => typeof v === 'boolean')
  const [retry, setRetry] = useState(0)
  const { data, loading, error } = useResource('/api/sector-performance', validData, refreshPolicies.maps, retry)
  const rows = [...(data?.sectors || [])].sort((a, b) => (b.returns[period] ?? -Infinity) - (a.returns[period] ?? -Infinity))
  const unavailable = rows.filter(r => r.returns[period] == null).length
  const dataInfo = data && <>
    <p className="sector-mobile-description">11개 업종 ETF의 완료된 거래일 성과 · {data.benchmark.starts[period] || '—'} → {data.benchmark.asOf || '—'}</p>
    <DataStatus basis={`${data.benchmark.asOf || '기준일 미제공'} · 미국 거래일 종가 · 장중 시세 아님`} source="Yahoo Finance" collectedAt={data.fetchedAt} stale={data.stale || error} />
    <p className="sector-note">Yahoo Finance · {data.basis}. 업종 전체 지수가 아닌 대표 ETF의 성과입니다. 1주는 7일, 1개월은 30일 전 또는 직전 거래일 대비이며, 연초 이후는 전년도 마지막 거래일 대비입니다.{!compact && ' 초과성과는 업종 ETF 수익률에서 VOO 수익률을 뺀 값입니다.'}</p>
  </>
  return <section className={`sector-panel ${compact ? 'sector-compact' : ''}`} aria-label="Maps · 미국 업종 ETF 히트맵">
    <div className={`sector-heading${compact ? ' widget-heading' : ''}`}><h2>{compact ? <Link to="/equity" data-widget-link aria-label="Maps 전체 업종 성과 보기">Maps</Link> : 'Maps'}</h2>
      {compact && <WidgetActions label="Maps" refresh={{ loading, onClick: () => setRetry(n => n + 1) }} info={{ id: infoId, label: 'Maps 출처와 산정 기준', open: infoOpen, disabled: !data, onClick: () => setInfoOpen(value => !value) }} />}
    </div>
    {controls}
    {compact && <div id={infoId} hidden={!infoOpen} className="widget-info-panel" data-widget-interactive>{dataInfo}</div>}
    {!compact && <p className="sector-description">11개 업종 ETF로 보는 시장의 흐름 · 완료된 거래일 기준</p>}
    <div className="sector-controls"><div className="sector-periods" role="group" aria-label="비교 기간">{periods.map(([key, label]) => <SelectionButton key={key} selected={period === key} selectionId={`${infoId}-period`} onClick={() => setPeriod(key)}>{label}</SelectionButton>)}</div>
      {!compact && <label><input type="checkbox" checked={relative} onChange={e => setRelative(e.target.checked)} /> VOO 대비 초과성과</label>}
    </div>
    <ResourceState label="업종 데이터" loading={loading} error={error} hasData={!!data} stale={data?.stale}
      updatedAt={data?.fetchedAt} onRetry={() => setRetry(n => n + 1)} layout="tiles" />
    {data && <>
      <div className="sector-summary"><span><span className="sector-benchmark-label">S&P 500 추종 ETF · </span>VOO <small className="sector-mobile-date">· {data.benchmark.asOf || '기준일 미제공'} 종가</small></span><strong>{format(data.benchmark.returns[period])}</strong></div>
      <p className="sector-date sector-period-range">{data.benchmark.starts[period] || '—'} → {data.benchmark.asOf || '—'} · 미국 거래일</p>
      {!!unavailable && <p className="sector-date">{unavailable}개 업종은 동일 기준일 데이터가 없어 표시하지 못했습니다.</p>}
      <div className="sector-grid">{rows.map(row => {
        const v = relative && !compact ? row.relative[period] : row.returns[period]
        if (onSelectSector) return <div key={row.symbol} className={`sector-tile sector-selectable sector-${tone(v)}${selectedSector === row.symbol ? ' is-selected' : ''}`}>
          <button type="button" aria-pressed={selectedSector === row.symbol} aria-label={`${row.name} 관련 기사 보기, ${format(v)}`} onClick={() => onSelectSector({ symbol: row.symbol, name: row.name })}><span>{row.name}</span><strong>{format(v)}</strong></button>
          <a href={`https://finance.yahoo.com/quote/${row.symbol}/`} target="_blank" rel="noopener noreferrer" aria-label={`${row.symbol}, Yahoo Finance 새 창`}>{row.symbol} ↗</a>
        </div>
        return <a key={row.symbol} className={`sector-tile sector-${tone(v)}`} href={`https://finance.yahoo.com/quote/${row.symbol}/`} target="_blank" rel="noopener noreferrer" aria-label={`${row.name} ${row.symbol} ${format(v, relative && !compact ? '%p' : '%')}, Yahoo Finance 새 창`}>
          <span>{row.name}</span><strong>{format(v, relative && !compact ? '%p' : '%')}</strong><small>{row.symbol} ↗</small>
        </a>
      })}</div>
      {!compact && <div className="sector-table-wrap"><table><caption>업종별 기간 성과{relative ? ' · VOO 대비 차이 (%p)' : ' (%)'}</caption><thead><tr><th scope="col">업종 / ETF</th>{periods.map(([key, label]) => <th scope="col" key={key}>{label}</th>)}</tr></thead><tbody>{[data.benchmark, ...rows].map(row => <tr key={row.symbol}><th scope="row">{row.name}<small>{row.symbol}</small></th>{periods.map(([key]) => <td key={key}>{format(relative ? row.relative[key] : row.returns[key], relative ? '%p' : '%')}</td>)}</tr>)}</tbody></table></div>}
      <div className="sector-compact-status"><span>{data.benchmark.asOf || '기준일 미제공'} 종가 기준 · Yahoo Finance</span>{!compact && <button className="sector-refresh" disabled={loading} onClick={() => setRetry(n => n + 1)}>새로고침</button>}</div>
      {!compact && <><button type="button" className="sector-info-toggle" aria-expanded={infoOpen} aria-controls={infoId} onClick={() => setInfoOpen(!infoOpen)}>정보 · 산정 기준 {infoOpen ? '−' : 'ⓘ'}</button>
      <div id={infoId} hidden={!infoOpen} className={`sector-data-info${infoOpen ? ' is-open' : ''}`}>{dataInfo}</div></>}
    </>}
  </section>
}
