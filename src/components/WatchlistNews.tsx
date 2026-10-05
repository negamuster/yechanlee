import { useState } from 'react'
import { useResource } from '../hooks/useResource'
import { useSessionState } from '../hooks/useSessionState'
import { isWebUrl } from '../lib/watchlist'
import { dataTime } from '../utils/dataTime'
import { BookmarkButton, useSavedItems } from './SavedItemsProvider'

type Article = { id: string; title: string; article_url: string; published_utc: string; publisher: { name: string }; tickers: string[] }
function validNews(value: unknown): value is { results: Article[] } {
  return !!value && typeof value === 'object' && Array.isArray((value as { results?: unknown }).results)
}
export default function WatchlistNews() {
  const { items } = useSavedItems()
  const [choice, setChoice] = useSessionState('watch.news', '', v => typeof v === 'string' && v.length <= 20)
  const ticker = items.stocks.some(s => s.ticker === choice) ? choice : items.stocks[0].ticker
  const [revision, setRevision] = useState(0)
  const path = `/v2/reference/news?ticker=${ticker}&limit=8&order=desc`
  const { data, loading, error } = useResource(`/api/stock-data?path=${encodeURIComponent(path)}`, validNews, 5 * 60000, revision)
  const articles = (data?.results || []).filter(a => a && typeof a.title === 'string' && isWebUrl(a.article_url) && typeof a.publisher?.name === 'string' && Number.isFinite(Date.parse(a.published_utc)) && Array.isArray(a.tickers) && a.tickers.includes(ticker))
  return <section aria-labelledby="watch-news"><h2 id="watch-news">관심 종목 뉴스</h2>
    <div className="watch-toolbar"><label>종목 <select value={ticker} onChange={e => setChoice(e.target.value)}>{items.stocks.map(s => <option key={s.ticker} value={s.ticker}>{s.ticker}</option>)}</select></label><button type="button" disabled={loading} onClick={() => setRevision(n => n + 1)}>새로고침</button></div>
    <p className="saved-note">Polygon / Massive의 종목 연결 기준 · 최근 제공 기사 최대 8개 · 여러 기업을 함께 다룬 기사가 포함될 수 있습니다.</p>
    {loading && <p role="status" className="saved-note">{ticker} 뉴스를 조회하고 있습니다.</p>}
    {error && <p role="status" className="watch-notice">뉴스 조회 실패{articles.length ? ' · 이전에 조회한 기사를 표시합니다.' : ' · 잠시 후 다시 시도해 주세요.'}</p>}
    {!loading && !error && !articles.length && <div className="saved-empty">제공된 기사 중 {ticker}에 연결된 기사가 없습니다.</div>}
    <ul className="saved-list watch-news-list">{articles.map(a => <li key={a.id || a.article_url}><a className="saved-content" href={a.article_url} target="_blank" rel="noopener noreferrer"><small>{a.publisher.name} · {dataTime(a.published_utc)}</small><strong>{a.title}</strong><span>원문 읽기 ↗</span></a><BookmarkButton article={{ ...a, publisher: a.publisher.name }} /></li>)}</ul>
  </section>
}
