import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './MarketMovers.css'

type Category = 'turnover' | 'gainers' | 'losers'
interface Mover { ticker: string; price: number; changePct: number | null; turnover: number | null; volume: number }
interface MoversData {
  tradingDate: string; previousTradingDate: string; fetchedAt: number; stale: boolean
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

export default function MarketMovers() {
  const [category, setCategory] = useState<Category>('turnover')
  const [data, setData] = useState<MoversData | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = setTimeout(() => controller.abort(), 25000)
    setLoading(true)
    async function load() {
      try {
        const response = await fetch('/api/market-movers', { signal: controller.signal })
        if (!response.ok) throw new Error('unavailable')
        const result = await response.json()
        if (!result.tradingDate || !Number.isFinite(result.fetchedAt)
          || !categories.every(tab => Array.isArray(result.rankings?.[tab.id]))) throw new Error('invalid')
        if (active) { setData(result); setFailed(false) }
      } catch { if (active) setFailed(true) }
      finally { clearTimeout(timeout); if (active) setLoading(false) }
    }
    void load()
    const interval = setInterval(() => setRefresh(value => value + 1), 30 * 60 * 1000)
    return () => { active = false; controller.abort(); clearTimeout(timeout); clearInterval(interval) }
  }, [refresh])

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
      <p className="movers-description">{selected.description} · 상위 10개</p>
      <div className="movers-status">
        <span>{data ? `${data.tradingDate} · 일별 마감 데이터 (미 동부)` : '최근 완료된 거래일 기준'}</span>
        <button type="button" disabled={loading} onClick={() => setRefresh(value => value + 1)}>
          {loading ? '불러오는 중…' : '새로고침'}
        </button>
      </div>
      {(failed || data?.stale) && <p className="movers-notice" role="status">
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
          </li>)}
        </ol>
      </div>
      <div className="movers-footnote">
        <p>미국 상장 종목 · ETF 포함 · 장외 제외<br />종가 $1 이상, 일 거래량 1만 주 이상</p>
        <p>거래대금 ≈ 거래량 가중 평균가격(VWAP) × 거래량<br />K = 천 · M = 백만 · B = 십억 달러</p>
        <p>출처: Polygon / Massive · 실시간 순위가 아닙니다.</p>
        {data && <p>수집: {new Date(data.fetchedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })} KST</p>}
      </div>
    </section>
  )
}
