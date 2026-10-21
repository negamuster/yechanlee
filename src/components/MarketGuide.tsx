import { validMarketData } from '../lib/marketQuotes'
import SectorPerformance from './SectorPerformance'
import { useState } from 'react'
import { useResource } from '../hooks/useResource'
import { refreshPolicies } from '../lib/refreshPolicy'
import ResourceState from './ResourceState'
import { marketGuides } from '../data/marketGuides'
import type { GuideId } from '../data/marketGuides'
import './MarketGuide.css'
function Snapshot({ symbols }: { symbols: readonly string[] }) {
  const [revision, setRevision] = useState(0)
  const { data, loading, error } = useResource('/api/market-indices', validMarketData, refreshPolicies.markets, revision)
  const retry = () => setRevision(n => n + 1)
  const quotes = data?.quotes ?? []
  if (!data) return <ResourceState label="주요 시세" loading={loading} error={error} hasData={false} onRetry={retry} />
  return <><ResourceState label="주요 시세" loading={loading} error={error} hasData={!!data} onRetry={retry} /><div className="guide-snapshot">{symbols.map(symbol => {
    const q = quotes.find(q => q.symbol === symbol)
    return <div key={symbol}><span>{q?.label || symbol}</span><strong>{q?.price != null ? q.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '조회 불가'} {q?.unit}</strong>
      <span>{q?.changePercent != null ? `${q.changePercent > 0 ? '+' : ''}${q.changePercent.toFixed(2)}% · 전일 종가 대비` : '등락률 미제공'}</span>
      <small>{q?.asOf ? new Date(q.asOf).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST' : '기준 시각 미제공'}</small></div>
  })}</div></>
}
export default function MarketGuide({ id }: { id: GuideId }) {
  const guide = marketGuides[id]
  return <main className="market-guide">
    <p className="guide-eyebrow">Market Explorer</p>
    <h1>{guide.title}</h1><p className="guide-description">{guide.description}</p>
    {!!guide.symbols.length && <section aria-label="주요 시세"><Snapshot key={id} symbols={guide.symbols} /><p className="guide-source">Yahoo Finance · 조회 시점에 수집한 지연 시세 포함 · 항목별 기준 시각 표시</p></section>}
    {id === 'equity' && <SectorPerformance />}
    <section className="guide-resources" aria-labelledby="guide-resources-title"><h2 id="guide-resources-title">데이터와 차트 확인</h2>
      <div>{guide.links.map(([label, url]) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">{label} ↗</a>)}</div>
      {!guide.symbols.length && <p className="guide-source">외부 공식 자료로 이동합니다. 최신 발표치와 발표 일정은 해당 기관에서 확인하세요.</p>}
    </section>
    <section className="guide-reading"><h2>어떻게 읽을까요?</h2>{guide.sections.map(([title, desc, note]) => <details key={title}><summary>{title}</summary><p>{desc}</p><p className="guide-note">{note}</p></details>)}</section>
  </main>
}

