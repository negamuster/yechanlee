import { useId, useState } from 'react'
import { financialMetrics, financialValue, financialDate, financialBasis } from '../lib/financialHistory'
import type { FinancialPeriod, FinancialMetric } from '../lib/financialHistory'
import { stockMoney } from '../lib/stockPresentation'
import { isWebUrl } from '../lib/watchlist'
import './FinancialHistory.css'

const modes = [{ key: 'annual', label: '연간' }, { key: 'quarterly', label: '분기' }, { key: 'ttm', label: 'TTM' }] as const
const calculationLabel = { difference: '누적 공시 차액', sum: '최근 4개 분기 합계', ocf_minus_capex: '영업현금흐름 − Capex' }
function TrendChart({ rows, metric, label }: { rows: FinancialPeriod[]; metric: FinancialMetric; label: string }) {
  if (new Set(rows.map(row => row.accounting_standard)).size > 1) return <p className="stock-empty-note">회계기준이 달라 차트로 비교하지 않습니다. 표에서 각 기간의 IFRS·US GAAP 기준을 확인해 주세요.</p>
  const points = [...rows].reverse().map(row => ({ row, value: financialValue(row, metric) }))
  const units = [...new Set(points.flatMap(p => p.value ? [p.value.unit] : []))]
  if (units.length !== 1) return <p className="stock-empty-note">{units.length ? '보고 통화가 달라 차트로 비교하지 않습니다. 표에서 각 기간의 통화를 확인해 주세요.' : '이 지표의 확인 가능한 값이 없습니다.'}</p>
  const bases = [...new Set(points.flatMap(p => p.value?.basis ? [p.value.basis] : []))]
  if (bases.length > 1) return <p className="stock-empty-note">Capex 범위가 달라 차트로 비교하지 않습니다. 표에서 유형자산·생산자산 취득 기준을 확인해 주세요.</p>
  const values = points.flatMap(p => p.value ? [p.value.value] : []), min = Math.min(0, ...values), max = Math.max(0, ...values)
  const scale = (value: number) => 170 - (value - min) / (max - min || 1) * 140
  const width = 720 / points.length, zero = scale(0)
  return <figure className="financial-trend"><figcaption>{label} {metric.label} · {units[0]} {financialBasis(bases[0])}<span>아래 표와 같은 값 · 미확인은 막대 미표시</span></figcaption>
    <svg viewBox="0 0 800 220" role="img" aria-label={`${label} ${metric.label} 추이 · ${units[0]}`}>
      <text x="0" y="22" className="financial-axis">{stockMoney(max, units[0], true)}</text>
      {min < 0 && <text x="0" y="188" className="financial-axis">{stockMoney(min, units[0], true)}</text>}
      <line x1="50" x2="790" y1={zero} y2={zero} />
      {points.map(({ row, value }, index) => <g key={row.end_date}>
        {value && <><title>{financialDate(row.end_date)}: {stockMoney(value.value, value.unit)} {value.unit}</title>
          <rect className={value.value < 0 ? 'is-negative' : ''} x={65 + width * index + width * .2} y={Math.min(zero, scale(value.value))} width={width * .6} height={Math.max(1, Math.abs(scale(value.value) - zero))} /></>}
        <text x={65 + width * (index + .5)} y="210" textAnchor="middle" className="financial-axis">{row.end_date.slice(0, 7)}</text>
      </g>)}
    </svg>
  </figure>
}

export default function FinancialHistory({ annual, quarterly = [], ttm = [], stale = false, unavailable = false, loading = false, onRetry }: { annual: FinancialPeriod[]; quarterly?: FinancialPeriod[]; ttm?: FinancialPeriod[]; stale?: boolean; unavailable?: boolean; loading?: boolean; onRetry?: () => void }) {
  const [mode, setMode] = useState<'annual' | 'quarterly' | 'ttm'>('annual')
  const [metricKey, setMetricKey] = useState('revenues'), [auditEnd, setAuditEnd] = useState('')
  const id = useId(), rows = { annual, quarterly, ttm }[mode], label = modes.find(m => m.key === mode)!.label
  const metric = financialMetrics.find(m => m.key === metricKey)!, audit = rows.find(row => row.end_date === auditEnd) || rows[0]
  return <div className="financial-history">
    <div className="financial-heading"><h3>재무 추이</h3><div className="financial-modes" role="group" aria-label="재무 조회 기간">{modes.map(m => <button type="button" key={m.key} aria-pressed={mode === m.key} onClick={() => setMode(m.key)}>{m.label}</button>)}</div></div>
    <p className="stock-note">{mode === 'annual' ? '최대 5개 연간 회계기간' : mode === 'quarterly' ? '최근 최대 8개 단독 분기 · 누적 자료와 구분' : '최근 4개 연속 분기 합계 · 연간 공시와 구분'} · SEC EDGAR</p>
    {stale && <p className="stock-alert" role="status">재무 갱신에 실패해 이전에 확인한 추이를 표시합니다.</p>}
    {unavailable && <button className="stock-text-button" type="button" disabled={loading} onClick={onRetry} aria-label="재무 추이 다시 조회">{loading ? '조회 중…' : '재무 자료 다시 조회'}</button>}
    {rows.length ? <>
      <label className="financial-metric-picker" htmlFor={`${id}-metric`}>차트 지표<select id={`${id}-metric`} value={metricKey} onChange={event => setMetricKey(event.target.value)}>{financialMetrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select></label>
      <TrendChart rows={rows} metric={metric} label={label} />
      <div className="financial-table-scroll" role="region" aria-label={`${label} 재무 추이 표, 좌우로 이동 가능`} tabIndex={0}>
        <table><caption>{label} 재무 추이 · 최신 기간부터 · 각 셀의 보고 통화 기준</caption><thead><tr><th scope="col">지표 / 기간 종료</th>{rows.map(row => <th scope="col" key={row.end_date}>{financialDate(row.end_date)}<small>{row.accounting_standard === 'ifrs-full' ? 'IFRS' : 'US GAAP'}{row.calculated ? ' · 계산' : ''}{row.amended ? ' · 수정 공시' : ''}</small></th>)}</tr></thead>
          <tbody>{financialMetrics.map(m => <tr key={m.key}><th scope="row">{m.label}</th>{rows.map(row => { const value = financialValue(row, m); return <td key={row.end_date} className={value && value.value < 0 ? 'is-negative' : ''}>{value ? <>{stockMoney(value.value, value.unit, true)}<small>{value.unit}{value.calculation ? ' · 계산' : ''}{value.basis && <small>{financialBasis(value.basis)}</small>}{value.sources?.some(s => s.revised) ? ' · 비교값 변경' : ''}</small></> : <span aria-label="미확인">—</span>}</td> })}</tr>)}
          <tr><th scope="row">회계기간</th>{rows.map(row => <td key={row.end_date}><small>{financialDate(row.start_date)}<br />~ {financialDate(row.end_date)}</small></td>)}</tr></tbody>
        </table>
      </div>
      <details className="financial-audit"><summary>계산·공시 근거 확인</summary>
        <label htmlFor={`${id}-audit`}>확인할 기간<select id={`${id}-audit`} value={audit.end_date} onChange={event => setAuditEnd(event.target.value)}>{rows.map(row => <option key={row.end_date} value={row.end_date}>{financialDate(row.end_date)} 종료</option>)}</select></label>
        <p>{financialDate(audit.start_date)} ~ {financialDate(audit.end_date)} · 제출 {financialDate(audit.filing_date)}{audit.amended ? ' · 수정 공시' : ''} · {isWebUrl(audit.source_filing_url) && <a href={audit.source_filing_url} target="_blank" rel="noopener noreferrer">기간 기준 원문 공시 ↗</a>}</p>
        {financialMetrics.map(m => { const value = financialValue(audit, m); return <div className="financial-audit-metric" key={m.key}><h4>{m.label} · {value ? `${stockMoney(value.value, value.unit)} ${value.unit}` : '미확인'}</h4>
          {value?.basis && <p>Capex 범위: {financialBasis(value.basis)}</p>}{value && <p>{value.calculation ? calculationLabel[value.calculation] : '공시값'}{value.sources?.some(s => s.revised) ? ' · 이전 제출 공시와 값이 다릅니다.' : ''}</p>}
          {value?.sources && <ul>{value.sources.map((source, index) => <li key={index}>{source.start_date && `${financialDate(source.start_date)} ~ `}{financialDate(source.end_date)} · {stockMoney(source.value, source.unit)} {source.unit} · <a href={source.url} target="_blank" rel="noopener noreferrer">{source.form} · 제출 {financialDate(source.filing_date)} ↗</a>{source.revised ? ' · 비교값 변경' : ''}</li>)}</ul>}
        </div> })}
      </details>
    </> : <p className="stock-empty-note" role="status">{unavailable ? '재무 자료를 불러오지 못했습니다. 위 버튼으로 다시 조회해 주세요.' : mode === 'quarterly' ? '확인 가능한 단독 분기 자료가 없습니다. 연간만 공시하거나 표준 분기 자료가 없는 기업은 분기를 제공하지 않을 수 있습니다.' : mode === 'ttm' ? '최근 4개 연속 분기의 회계기준·통화·수정 여부를 확인하지 못해 TTM을 계산하지 않습니다.' : '확인 가능한 연간 재무 자료가 없습니다.'}</p>}
    <p className="financial-method">FCF = 영업현금흐름 − Capex. Capex는 유형자산 취득 현금유출을 우선 사용하며, 없으면 공시된 생산자산 취득 총액(무형자산 등이 포함될 수 있음)을 사용합니다. 범위는 표에 표시하며, 회사가 발표한 조정 FCF와 다를 수 있습니다. 분기 현금흐름과 4분기는 누적 공시 차액일 수 있습니다. 통화·회계기간·Capex 범위·수정 여부가 맞지 않으면 계산하지 않으며, 미확인 값은 0으로 대체하지 않습니다.</p>
  </div>
}
