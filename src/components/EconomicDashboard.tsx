import { useMemo, useState } from 'react'
import { useResource } from '../hooks/useResource'
import { refreshPolicies } from '../lib/refreshPolicy'
import { economicDefinitions, economicStatus, economicComparison, economicWindow, economicDate, economicValue, economicChange, validEconomicData } from '../lib/economicIndicators'
import type { EconomicId, EconomicPoint } from '../lib/economicIndicators'
import { dataTime } from '../utils/dataTime'
import ResourceState from './ResourceState'
import EconomicChart from './EconomicChart'
import './EconomicDashboard.css'
function ObservationTable({ points, daily, cpi }: { points: EconomicPoint[]; daily: boolean; cpi: boolean }) {
  const [page, setPage] = useState(0)
  const rows = [...points].reverse(), pageSize = 12, pages = Math.ceil(rows.length / pageSize)
  return <details className="economic-table"><summary>조회 표 · {rows.length}개 관측 기간</summary>
    <div className="economic-table-scroll" tabIndex={0} role="region" aria-label="경제지표 조회 표 스크롤"><table><caption>선택한 기간의 관측치 · 최신순 · 단위 %</caption><thead><tr><th scope="col">관측 기간</th><th scope="col">관측치 (%)</th>{cpi && <th scope="col">CPI 원지수</th>}<th scope="col">자료 참고</th></tr></thead><tbody>{rows.slice(page * pageSize, (page + 1) * pageSize).map(p => <tr key={p.date}><th scope="row"><time dateTime={p.date}>{economicDate(p.date, daily)}</time></th><td>{economicValue(p.value)}</td>{cpi && <td>{p.index == null ? '미제공' : p.index.toFixed(3)}</td>}<td>{p.note || '—'}</td></tr>)}</tbody></table></div>
    {pages > 1 && <nav className="economic-pagination" aria-label="경제지표 표 페이지"><button type="button" disabled={!page} onClick={() => setPage(p => p - 1)}>이전</button><span aria-live="polite">{page + 1} / {pages}</span><button type="button" disabled={page + 1 >= pages} onClick={() => setPage(p => p + 1)}>다음</button></nav>}
  </details>
}
export default function EconomicDashboard() {
  const [revision, setRevision] = useState(0), [selected, setSelected] = useState<EconomicId>('cpi'), [years, setYears] = useState(3)
  const { data, loading, error } = useResource('/api/economic-indicators', validEconomicData, refreshPolicies.indicators, revision)
  const definition = economicDefinitions.find(d => d.id === selected)!, series = data?.series.find(s => s.id === selected)
  const selectedStatus = series ? economicStatus(series) : 'unavailable'
  const points = useMemo(() => series && selectedStatus !== 'unavailable' ? economicWindow(series, years) : [], [series, years, selectedStatus])
  const daily = definition.frequency === 'daily', comparison = series ? economicComparison(series) : null
  return <section className="economic-dashboard" aria-labelledby="economic-title">
    <div className="economic-heading"><div><p className="economic-kicker">U.S. ECONOMY</p><h2 id="economic-title">주요 경제지표</h2></div><button className="economic-refresh" type="button" disabled={loading} onClick={() => setRevision(n => n + 1)}>{loading ? '확인 중…' : '새로고침'}</button></div>
    <p className="economic-intro">공식 API 자료를 매일 수집합니다. 새로고침은 사이트에 수집된 자료를 다시 확인합니다. 관측 기간은 발표일과 다르며, 과거 값에는 공식 수정치가 반영될 수 있습니다.</p>
    <ResourceState label="경제지표" loading={loading} error={error} hasData={!!data} onRetry={() => setRevision(n => n + 1)} failureDetail="마지막으로 확인한 자료가 있으면 원래 수집 시각과 함께 표시합니다." />
    {data && <><div className="economic-cards" role="group" aria-label="경제지표 선택">{economicDefinitions.map(d => {
      const s = data.series.find(s => s.id === d.id)!, status = economicStatus(s), { latest, previous, change } = economicComparison(s), isDaily = d.frequency === 'daily'
      return <button type="button" className="economic-card" key={d.id} aria-pressed={selected === d.id} onClick={() => setSelected(d.id)}>
        <span className="economic-card-label">{d.label}<span className={`economic-status economic-status-${status}`}>{status === 'ok' ? '수집 정상' : status === 'stale' ? '갱신 지연' : '조회 불가'}</span></span>
        <strong>{status === 'unavailable' ? '조회 불가' : economicValue(latest?.value)}</strong>
        <span className="economic-period">{latest ? <time dateTime={latest.date}>{economicDate(latest.date, isDaily)}</time> : '관측 기간 미확인'} · {isDaily ? '일별' : '월별'} · {d.adjustment}</span>
        <span>{isDaily ? '직전 제공 영업일' : '전월'} {status === 'unavailable' ? '비교 불가' : economicChange(change)}</span>
        <small>{previous ? `${economicDate(previous.date, isDaily)} · ${status === 'unavailable' ? '조회 불가' : economicValue(previous.value)}` : '이전 관측치 미제공'}</small>
      </button>
    })}</div>
    <div className="economic-detail" aria-labelledby="economic-chart-title"><div className="economic-chart-heading"><div><h3 id="economic-chart-title">{definition.label} 추이</h3><p>단위 % · {daily ? '영업일별' : '월별'} · {definition.adjustment}</p></div><div className="economic-periods" role="group" aria-label="추이 조회 기간">{[1, 3, 5].map(n => <button type="button" key={n} aria-pressed={years === n} onClick={() => setYears(n)}>{n}Y</button>)}</div></div>
      <p className="economic-description">{definition.description}</p>
      {series && economicStatus(series) !== 'ok' && <p className="economic-warning" role="status">{economicStatus(series) === 'stale' ? '갱신 지연 · 마지막으로 확인한 자료를 표시합니다. 아래 관측 기간과 수집 시각을 확인하세요.' : '이 지표의 유효한 자료를 확인하지 못했습니다. 다른 지표와 공식 원문은 계속 확인할 수 있습니다.'}</p>}
      {points.some(p => p.value != null) ? <><EconomicChart points={points} label={definition.label} daily={daily} /><p className="economic-range">{economicDate(points[0].date, daily)} ~ {economicDate(points.at(-1)!.date, daily)} · 결측값은 연결하거나 0으로 대체하지 않습니다.</p><ObservationTable key={`${selected}-${years}`} points={points} daily={daily} cpi={selected === 'cpi'} /></> : <p className="economic-empty">표시할 관측치가 없습니다.</p>}
      {comparison?.latest && series && economicStatus(series) !== 'unavailable' && <p className="economic-latest">최근 관측 기간 <time dateTime={comparison.latest.date}>{economicDate(comparison.latest.date, daily)}</time> · {economicValue(comparison.latest.value)}{comparison.latest.note ? ` · ${comparison.latest.note}` : ''}</p>}
      <div className="economic-source"><p>출처 <a href={definition.url} target="_blank" rel="noopener noreferrer">{definition.provider} ↗</a> · {definition.seriesId}</p><p>공식 API 수집 <time dateTime={series?.collectedAt || undefined}>{dataTime(series?.collectedAt)}</time></p><p>관측치가 오래되었거나 수집 후 48시간이 지나면 갱신 지연으로 표시합니다. 수집 후 30일이 지난 자료는 표시하지 않습니다.</p></div>
    </div>
    <details className="economic-attribution"><summary>자료 출처·이용 안내</summary><p>CPI 전년동월비는 Anthracite가 BLS 원지수로 계산한 값입니다. BLS.gov는 자료 수집 이후의 자료 및 이를 활용한 분석의 정확성과 적시성을 보증하지 않습니다. <a href="https://www.bls.gov/developers/termsOfService.htm" target="_blank" rel="noopener noreferrer">BLS 이용 조건 ↗</a></p><p>연방기금 실효금리(EFFR)는 newyorkfed.org의 이용 조건을 따릅니다. 뉴욕 연준은 Anthracite의 EFFR 게시에 책임을 지지 않으며, 특정 재게시를 승인하거나 보증하지 않고, 이용에 대한 책임을 지지 않습니다. <a href="https://www.newyorkfed.org/privacy/termsofuse" target="_blank" rel="noopener noreferrer">뉴욕 연준 이용 조건 ↗</a></p></details>
    </>}
  </section>
}
