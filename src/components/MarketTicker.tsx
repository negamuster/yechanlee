import { validMarketData } from '../lib/marketQuotes'
import { refreshPolicies } from '../lib/refreshPolicy'
import { dataTime } from '../utils/dataTime'
import { useState } from 'react'
import { useResource } from '../hooks/useResource'
import ResourceState from './ResourceState'
import './MarketTicker.css'

export default function MarketTicker() {
  const [infoOpen, setInfoOpen] = useState(false)
  const [paused, setPaused] = useState(false)
  const [revision, setRevision] = useState(0)
  const { data, loading, error: failed } = useResource('/api/market-indices', validMarketData, refreshPolicies.markets, revision)
  const quotes = data?.quotes ?? []
  const fetchedAt = data?.fetchedAt ?? null
  const partial = quotes.some(quote => quote.price === null)
  return <section className="market-ticker" aria-label="세계 주요 시장 시세">
    <div className="market-ticker-meta">
      <strong>Market Overview</strong>
      <button type="button" className="ticker-info-toggle" aria-expanded={infoOpen} aria-controls="ticker-data-info" onClick={() => setInfoOpen(!infoOpen)}>정보 ⓘ</button>
      <button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? '재개' : '멈춤'}</button>
      <button type="button" disabled={loading} onClick={() => setRevision(v => v + 1)}>{loading ? '확인 중…' : '새로고침'}</button>
    </div>
    <div id="ticker-data-info" className="ticker-data-info" hidden={!infoOpen}><p className="market-ticker-message">Yahoo Finance · 지연 시세 포함(지연 시간 미확인) · 화면을 보는 동안 1분마다 조회{fetchedAt !== null && <> · 서버 조회 {dataTime(fetchedAt)}</>} · 시세 기준은 각 항목에 표시 · 휴장 시 최근 시세</p></div>
    <ResourceState label="시장 시세" loading={loading} error={failed} hasData={!!data} stale={partial} updatedAt={fetchedAt}
      failureMessage={!failed && partial ? '일부 시세를 확인하지 못했습니다.' : undefined}
      onRetry={() => setRevision(value => value + 1)} layout="ticker" />
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
            <span className="market-ticker-time">{q.asOf ? `시세 기준 ${dataTime(q.asOf)}` : '시세 미제공'}</span>
          </a>)}
        </div>)}
      </div>
    </div>}
  </section>
}

