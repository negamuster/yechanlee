import { SelectionTools } from './SavedSelection'
import { useSavedSelection } from '../hooks/useSavedSelection'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSessionState } from '../hooks/useSessionState'
import { cachedResource, loadResource } from '../utils/resourceCache'
import { dataTime } from '../utils/dataTime'
import { sortStocks, isQuotes } from '../lib/watchlist'
import type { Quote, Sort } from '../lib/watchlist'
import { useSavedItems, WatchButton } from './SavedItemsProvider'
import './Watchlist.css'

export default function WatchlistPanel() {
  const { items } = useSavedItems()
  const [search, setSearch] = useState('')
  const selection = useSavedSelection('stocks', items.stocks.map(s => s.ticker))
  const [sort, setSort] = useSessionState<Sort>('watch.sort', 'saved', v => ['saved', 'name', 'change'].includes(String(v)))
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{ key: string; revision: number; quotes: Record<string, Quote>; failed: boolean; finished: boolean }>({ key: '', revision: -1, quotes: {}, failed: false, finished: false })
  const symbols = items.stocks.map(s => s.ticker).sort().join(',')
  useEffect(() => {
    if (!symbols) return
    let active = true
    const tickers = symbols.split(',')
    const quotes: Record<string, Quote> = {}
    let failed = false
    async function collect() {
      for (let i = 0; i < tickers.length; i += 8) {
        if (!active) return
        const url = `/api/watchlist?tickers=${encodeURIComponent(tickers.slice(i, i + 8).join(','))}`
        try {
          const data = await loadResource(url, isQuotes, 120000, revision > 0)
          for (const quote of data.quotes) quotes[quote.ticker] = quote
          failed ||= data.quotes.some(q => q.stale)
        } catch {
          failed = true
          for (const quote of cachedResource<{ quotes: Quote[] }>(url)?.data.quotes || []) quotes[quote.ticker] = { ...quote, stale: true }
        }
        if (active) setState({ key: symbols, revision, quotes: { ...quotes }, failed, finished: i + 8 >= tickers.length })
      }
    }
    void collect()
    return () => { active = false }
  }, [symbols, revision])
  const loading = !!symbols && (state.key !== symbols || state.revision !== revision || !state.finished)
  const rows = sortStocks(items.stocks, state.quotes, sort).filter(s => `${s.ticker} ${s.name}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  return <section aria-labelledby="saved-stocks">
    <h2 id="saved-stocks">관심 종목 <span>{items.stocks.length}</span></h2>
    {!items.stocks.length ? <div className="saved-empty">상단에서 종목을 검색하거나 <Link to="/markets">Market Movers</Link>에서 ‘관심 저장’을 눌러 주세요.</div> : <>
      <div className="watch-toolbar"><label>종목 검색 <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="티커·종목명" /></label><label>정렬 <select value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="saved">저장순</option><option value="name">이름순</option><option value="change">등락률 높은 순</option></select></label><button type="button" disabled={loading} onClick={() => setRevision(n => n + 1)}>{loading ? '조회 중…' : '시세 새로고침'}</button></div>
      <p className="saved-note">Yahoo Finance · 지연 시세 포함(지연 시간 미확인) · 정규장 시세 기준 · 휴장 시 최근 시세 · 등락률은 전 거래일 종가 대비</p>
      {state.failed && <p className="watch-notice" role="status">일부 시세를 갱신하지 못했습니다. 이전 시세 또는 ‘확인 불가’로 표시합니다.</p>}
      <SelectionTools selection={selection} visible={rows.map(s => s.ticker)} />
      {!rows.length && <p role="status">검색 결과가 없습니다.</p>}
      <ul className="watch-list" aria-busy={loading}>{rows.map(stock => {
        const quote = state.quotes[stock.ticker]
        return <li key={stock.ticker}><div className="watch-row"><label className="saved-checkbox"><input type="checkbox" aria-label={`${stock.ticker} 선택`} checked={selection.selected.includes(stock.ticker)} onChange={() => selection.toggle(stock.ticker)} /></label><Link to={`/stock/${encodeURIComponent(stock.ticker)}`} className="watch-stock"><strong>{stock.ticker}</strong><span>{stock.name === stock.ticker ? '종목 상세 →' : stock.name}</span></Link><div className="watch-price"><strong>{quote?.price != null ? `${quote.price.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} ${quote.currency || '통화 미확인'}` : loading ? '조회 중' : '확인 불가'}</strong><span className={quote?.changePercent == null ? '' : quote.changePercent >= 0 ? 'watch-up' : 'watch-down'}>{quote?.changePercent != null ? `${quote.changePercent > 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%` : '—'}</span></div><WatchButton {...stock} /></div><p className="watch-time">시세 기준 {dataTime(quote?.asOf)}{quote?.stale ? ' · 갱신 실패: 이전 시세' : ''}</p></li>
      })}</ul>
    </>}
  </section>
}
