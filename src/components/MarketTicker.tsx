import { useEffect, useState } from 'react'
import './MarketTicker.css'

type Quote = { symbol: string; label: string; price: number | null; changePercent: number | null; asOf: string | null; unit: string; status: string }
export default function MarketTicker() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [failed, setFailed] = useState(false)
  const [paused, setPaused] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      try {
        const response = await fetch('/api/market-indices', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(22000)]) })
        const data = await response.json()
        if (!Array.isArray(data.quotes)) throw new Error('Invalid quotes')
        if (active) { setQuotes(data.quotes); setFailed(!response.ok) }
      } catch { if (active) { setFailed(true); setQuotes([]) } }
      finally { if (active) timer = setTimeout(refresh, 60000) }
    }
    void refresh()
    return () => { active = false; controller.abort(); clearTimeout(timer) }
  }, [revision])
  return <section className="market-ticker" aria-label="세계 주요 시장 시세">
    <div className="market-ticker-meta">
      <strong>Market Overview</strong>
      <span>Yahoo Finance · 지연 시세 포함 · 1분마다 조회 · 각 항목에 기준 시각 표시</span>
      <button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? '흐름 재개' : '흐름 멈춤'}</button>
      <button type="button" onClick={() => setRevision(v => v + 1)}>새로고침</button>
    </div>
    {failed && <p className="market-ticker-message" role="status">시세를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
    {!quotes.length && !failed && <p className="market-ticker-message" role="status">시장 시세를 불러오는 중…</p>}
    {!!quotes.length && <div className="market-ticker-window">
      <div className={`market-ticker-track${paused ? ' is-paused' : ''}`}>
        {[0, 1].map(copy => <div key={copy} className="market-ticker-group" aria-hidden={copy === 1 ? true : undefined}>
          {quotes.map(q => <a key={q.symbol} className="market-ticker-item" tabIndex={copy ? -1 : 0}
            href={`https://finance.yahoo.com/quote/${encodeURIComponent(q.symbol)}/`} target="_blank" rel="noopener noreferrer">
            <span className="market-ticker-value"><strong>{q.label}</strong>
              <span>{q.price === null ? '조회 불가' : q.price.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} {q.unit}</span>
              {q.changePercent !== null && <span className={q.changePercent > 0 ? 'ticker-up' : q.changePercent < 0 ? 'ticker-down' : ''}>
                {q.changePercent > 0 ? '▲' : q.changePercent < 0 ? '▼' : ''} {Math.abs(q.changePercent).toFixed(2)}%</span>}
            </span>
            <span className="market-ticker-time">{q.asOf ? `${new Date(q.asOf).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} KST` : '시세 미제공'}</span>
          </a>)}
        </div>)}
      </div>
    </div>}
  </section>
}
