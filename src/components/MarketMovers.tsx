import { useResource } from '../hooks/useResource'
import { useSessionState } from '../hooks/useSessionState'
import DataStatus from './DataStatus'
import { WatchButton } from './SavedItemsProvider'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './MarketMovers.css'

type Category = 'turnover' | 'gainers' | 'losers'
interface Mover { ticker: string; price: number; changePct: number | null; turnover: number | null; volume: number }
interface MoversData {
  tradingDate: string; previousTradingDate: string; fetchedAt: number; stale: boolean; pendingLatest?: boolean
  rankings: Record<Category, Mover[]>
}
const categories: { id: Category; label: string; description: string }[] = [
  { id: 'turnover', label: '거래대금', description: '추정 거래대금 높은 순' },
  { id: 'gainers', label: '상승', description: '전 거래일 대비 상승률 높은 순' },
  { id: 'losers', label: '하락', description: '전 거래일 대비 하락률 높은 순' },
]
const dollars = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const amount = (value: number) => {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
  return dollars(value)
}

function validData(value: unknown): value is MoversData {
  const data = value as MoversData | null
  return !!data && !!data.tradingDate && Number.isFinite(data.fetchedAt) && categories.every(tab => Array.isArray(data.rankings?.[tab.id]))
}

export default function MarketMovers() {
  const [category, setCategory] = useSessionState<Category>('movers.category', 'turnover', v => categories.some(tab => tab.id === v))
  const [refresh, setRefresh] = useState(0)

  const { data, loading, error: failed } = useResource('/api/market-movers', validData, 5 * 60000, refresh)
  useEffect(() => {
    const interval = setInterval(() => setRefresh(value => value + 1), 30 * 60000)
    return () => clearInterval(interval)
  }, [])

  const selected = categories.find(tab => tab.id === category)!
  const rows = data?.rankings[category] ?? []
  return (
    <section className="market-movers" aria-labelledby="market-movers-heading">
      <div className="movers-heading">
        <h2 id="market-movers-heading">Market Movers</h2>
        <span>미국 · USD</span>
      </div>
      <div className="movers-tabs" role="group" aria-label="종목 순위 기준">
        {categories.map(tab => <button key={tab.id} type="button" aria-pressed={category === tab.id}
          onClick={() => setCategory(tab.id)}>{tab.label}</button>)}
      </div>
      
      <div className="movers-status">
        <span>{data ? `${data.tradingDate} 종가 기준 · 실시간 아님` : '최근 완료된 거래일 기준'}</span>
        <button type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)}>
          {loading ? '불러오는 중…' : '새로고침'}
        </button>
      </div>
      {data && (failed || data.stale) && <p className="movers-notice" role="status">갱신 실패 · 이전 데이터 표시 중</p>}
      {data?.pendingLatest && <p className="movers-notice" role="status">최신 거래일 집계가 부족해 이전 거래일 순위를 표시합니다.</p>}
      <details className="movers-info"><summary>정보 ⓘ · 출처·산정 기준</summary>
      <p>{selected.description} · 상위 10개</p>
      {data && <DataStatus basis={`${data.tradingDate} · 미국 거래일 종가 · 실시간 순위 아님`} source="Polygon / Massive" collectedAt={data.fetchedAt} stale={failed || data.stale} />}
      <div className="movers-footnote">
        <p>미국 상장 종목 · ETF 포함 · 장외 제외<br />종가 $1 이상, 일 거래량 1만 주 이상</p>
        <p>거래대금 ≈ 거래량 가중 평균가격(VWAP) × 거래량<br />K = 천 · M = 백만 · B = 십억 달러</p>
        <p>출처: Polygon / Massive · 실시간 순위가 아닙니다. 미국 동부시간 21시 이후 당일 집계를 확인하며, 수집 범위가 부족하면 이전 거래일을 유지합니다.</p>
      </div>
      </details>
      {failed && !data && <p className="movers-notice" role="status">
        {data ? '최신 데이터를 받지 못해 마지막으로 수집한 순위를 표시합니다.' : '종목 순위를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}
      </p>}
      <div aria-busy={loading} aria-live="polite">
        {loading && !data && <p className="movers-empty">거래일과 종목 순위를 확인하고 있습니다.</p>}
        {!loading && data && !rows.length && <p className="movers-empty">조건에 맞는 종목이 없습니다.</p>}
        <ol className="movers-list" aria-label={selected.description}>
          {rows.map((row, index) => <li key={row.ticker}>
            <Link to={`/stock/${encodeURIComponent(row.ticker)}`} className="mover-row">
              <span className="mover-rank" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <div className="mover-identity"><strong>{row.ticker}</strong>
                <span>{category === 'turnover'
                  ? `거래대금 ≈ ${row.turnover === null ? '—' : amount(row.turnover)}`
                  : `거래량 ${row.volume.toLocaleString('ko-KR')}주`}</span>
              </div>
              <div className="mover-price"><span>{dollars(row.price)}</span>
                <span className={row.changePct === null || row.changePct === 0 ? 'mover-neutral' : row.changePct > 0 ? 'mover-up' : 'mover-down'}>
                  {row.changePct === null ? '등락률 없음' : `${row.changePct > 0 ? '+' : ''}${row.changePct.toFixed(2)}%`}
                </span>
              </div>
            </Link>
            <WatchButton ticker={row.ticker} />
          </li>)}
        </ol>
      </div>

    </section>
  )
}

