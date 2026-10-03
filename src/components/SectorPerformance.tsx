import { dataTime } from '../utils/dataTime'
import DataStatus from './DataStatus'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './SectorPerformance.css'
const periods = [['1d', '1일'], ['1w', '1주'], ['1m', '1개월'], ['ytd', '연초 이후']] as const
type Period = typeof periods[number][0]
type Row = { symbol: string; name: string; returns: Record<Period, number | null>; relative: Record<Period, number | null>; starts: Record<Period, string | null>; asOf: string | null }
type Data = { sectors: Row[]; benchmark: Row; fetchedAt: string; stale: boolean; basis: string }
const format = (v: number | null | undefined, unit = '%') => v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}${unit}`
const tone = (v: number | null) => v == null || v === 0 ? 'flat' : v > 0 ? 'positive' : 'negative'
export default function SectorPerformance({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<Data | null>(null)
  const [period, setPeriod] = useState<Period>('1d')
  const [infoOpen, setInfoOpen] = useState(false)
  const [relative, setRelative] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/sector-performance', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) })
        if (!response.ok) throw new Error()
        const result = await response.json()
        if (!Array.isArray(result.sectors) || !result.benchmark) throw new Error()
        if (!controller.signal.aborted) { setData(result); setError(false) }
      } catch { if (!controller.signal.aborted) setError(true) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [retry])
  const rows = [...(data?.sectors || [])].sort((a, b) => (b.returns[period] ?? -Infinity) - (a.returns[period] ?? -Infinity))
  const unavailable = rows.filter(r => r.returns[period] == null).length
  return <section className={`sector-panel ${compact ? 'sector-compact' : ''}`} aria-label="Maps · 미국 업종 ETF 히트맵">
    <div className="sector-heading"><div><h2>Maps</h2></div>{compact && <Link to="/equity">전체 보기 ↗</Link>}</div>
    <p className="sector-description">11개 업종 ETF로 보는 시장의 흐름 · 완료된 거래일 기준</p>
    <div className="sector-controls"><div className="sector-periods" aria-label="비교 기간">{periods.map(([key, label]) => <button key={key} aria-pressed={period === key} onClick={() => setPeriod(key)}>{label}</button>)}</div>
      {!compact && <label><input type="checkbox" checked={relative} onChange={e => setRelative(e.target.checked)} /> VOO 대비 초과성과</label>}
    </div>
    {loading && <p role="status">업종 데이터를 불러오는 중…</p>}
    {error && !data && <p role="status">업종 데이터를 불러오지 못했습니다.</p>}
    {data && <>
      <div className="sector-summary"><span><span className="sector-benchmark-label">S&P 500 추종 ETF · </span>VOO <small className="sector-mobile-date">· {data.benchmark.asOf || '기준일 미제공'} 종가</small></span><strong>{format(data.benchmark.returns[period])}</strong></div>
      <p className="sector-date sector-period-range">{data.benchmark.starts[period] || '—'} → {data.benchmark.asOf || '—'} · 미국 거래일</p>
      {(data.stale || error) && <p className="sector-stale-alert" role="status">갱신 실패 · 이전 데이터 표시 중 · 마지막 정상 수집 {dataTime(data.fetchedAt)}</p>}
      {!!unavailable && <p className="sector-date">{unavailable}개 업종은 동일 기준일 데이터가 없어 표시하지 못했습니다.</p>}
      <div className="sector-grid">{rows.map(row => {
        const v = relative && !compact ? row.relative[period] : row.returns[period]
        return <a key={row.symbol} className={`sector-tile sector-${tone(v)}`} href={`https://finance.yahoo.com/quote/${row.symbol}/`} target="_blank" rel="noopener noreferrer" aria-label={`${row.name} ${row.symbol} ${format(v, relative && !compact ? '%p' : '%')}, Yahoo Finance 새 창`}>
          <span>{row.name}</span><strong>{format(v, relative && !compact ? '%p' : '%')}</strong><small>{row.symbol} ↗</small>
        </a>
      })}</div>
      {!compact && <div className="sector-table-wrap"><table><caption>업종별 기간 성과{relative ? ' · VOO 대비 차이 (%p)' : ' (%)'}</caption><thead><tr><th scope="col">업종 / ETF</th>{periods.map(([key, label]) => <th scope="col" key={key}>{label}</th>)}</tr></thead><tbody>{[data.benchmark, ...rows].map(row => <tr key={row.symbol}><th scope="row">{row.name}<small>{row.symbol}</small></th>{periods.map(([key]) => <td key={key}>{format(relative ? row.relative[key] : row.returns[key], relative ? '%p' : '%')}</td>)}</tr>)}</tbody></table></div>}
      <button type="button" className="sector-info-toggle" aria-expanded={infoOpen} aria-controls="sector-data-info" onClick={() => setInfoOpen(!infoOpen)}>데이터·산정 기준 {infoOpen ? '−' : 'ⓘ'}</button>
      <div id="sector-data-info" className={`sector-data-info${infoOpen ? ' is-open' : ''}`}>
      <p className="sector-mobile-description">11개 업종 ETF의 완료된 거래일 성과 · {data.benchmark.starts[period] || '—'} → {data.benchmark.asOf || '—'}</p>
      <DataStatus basis={`${data.benchmark.asOf || '기준일 미제공'} · 미국 거래일 종가 · 장중 시세 아님`} source="Yahoo Finance" collectedAt={data.fetchedAt} stale={data.stale || error} />
      <p className="sector-note">Yahoo Finance · {data.basis}. 업종 전체 지수가 아닌 대표 ETF의 성과입니다. 1주는 7일, 1개월은 30일 전 또는 직전 거래일 대비이며, 연초 이후는 전년도 마지막 거래일 대비입니다.{!compact && ' 초과성과는 업종 ETF 수익률에서 VOO 수익률을 뺀 값입니다.'}</p>
      </div>
    </>}
    <button className="sector-refresh" disabled={loading} onClick={() => { setLoading(true); setRetry(n => n + 1) }}>다시 조회</button>
  </section>
}
