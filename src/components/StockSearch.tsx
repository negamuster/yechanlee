import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
interface Match { ticker: string; name: string; primary_exchange?: string }
const aliases: Record<string, string> = { '애플':'AAPL', '엔비디아':'NVDA', '테슬라':'TSLA', '마이크로소프트':'MSFT', '아마존':'AMZN', '알파벳':'GOOGL', '구글':'GOOGL', '인텔':'INTC', '팔란티어':'PLTR' }
export default function StockSearch({ onSelect }: { onSelect: () => void }) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [opened, setOpened] = useState(false)
  const [active, setActive] = useState(-1)
  const [status, setStatus] = useState('')
  const cache = useRef(new Map<string, Match[]>())
  const navigate = useNavigate()
  const search = aliases[query.trim()] || query.trim()
  useEffect(() => {
    const controller = new AbortController()
    let live = true
    setMatches([]); setActive(-1)
    if (search.length < 1) { setStatus(''); return }
    setStatus('검색 중…')
    const timer = window.setTimeout(async () => {
      try {
        let results = cache.current.get(search.toLowerCase())
        if (!results) {
          const response = await fetch(`/api/stock-data?search=${encodeURIComponent(search)}`, { signal: controller.signal })
          if (!response.ok) throw new Error('search unavailable')
          const data = await response.json()
          results = (Array.isArray(data.results) ? data.results : []).filter((row: Match) => typeof row.ticker === 'string' && typeof row.name === 'string')
          results = results!.sort((a, b) => Number(b.ticker === search.toUpperCase()) - Number(a.ticker === search.toUpperCase())).slice(0, 8)
          if (cache.current.size > 50) cache.current.clear()
          cache.current.set(search.toLowerCase(), results)
        }
        if (live) { setMatches(results); setStatus(results.length ? '' : '검색 결과가 없습니다. 영문 회사명이나 티커를 입력해 주세요.') }
      } catch { if (live) setStatus('검색을 불러오지 못했습니다. 정확한 티커를 입력하고 Enter를 눌러 주세요.') }
    }, 350)
    return () => { live = false; controller.abort(); clearTimeout(timer) }
  }, [search, query])
  function select(ticker: string) { setQuery(ticker); setOpened(false); navigate(`/stock/${encodeURIComponent(ticker)}`); onSelect() }
  return <form className="site-search" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpened(false) }} onSubmit={e => {
    e.preventDefault()
    const selected = matches[active] || matches.find(row => row.ticker === search.toUpperCase())
    if (selected) select(selected.ticker)
    else if (/^[A-Z][A-Z0-9.-]{0,5}$/.test(search)) select(search.toUpperCase())
    else { setOpened(true); setStatus('검색 결과에서 원하는 종목을 선택해 주세요.') }
  }}>
    <label className="news-sr-only" htmlFor="site-stock-search">미국 종목명 또는 티커 검색</label>
    <input id="site-stock-search" role="combobox" aria-autocomplete="list" aria-expanded={opened && !!query.trim()} aria-controls="stock-search-options"
      aria-activedescendant={active >= 0 && opened ? `stock-option-${active}` : undefined}
      autoComplete="off" maxLength={60} value={query} placeholder="종목명·티커 검색 (Apple, AAPL…)"
      onFocus={() => setOpened(true)} onChange={e => { setQuery(e.target.value); setOpened(true); setMatches([]); setActive(-1) }}
      onKeyDown={e => {
        if (e.nativeEvent.isComposing) { if (e.key === 'Enter') e.preventDefault(); return }
        if (e.key === 'ArrowDown') { e.preventDefault(); setOpened(true); setActive(value => Math.min(value + 1, matches.length - 1)) }
        if (e.key === 'ArrowUp') { e.preventDefault(); setActive(value => Math.max(value - 1, -1)) }
        if (e.key === 'Escape') { setOpened(false); setActive(-1) }
      }} />
    <button type="submit" aria-label="종목 검색"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg></button>
    {opened && query.trim() && <div className="stock-search-dropdown">
      <p className="stock-search-hint">미국 상장 종목 · ↑↓ 이동 · Enter 선택</p>
      <div id="stock-search-options" role="listbox" aria-label="종목 검색 결과">
        {matches.map((row, index) => <div key={row.ticker} id={`stock-option-${index}`} role="option" aria-selected={active === index}
          className="stock-search-option" onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => select(row.ticker)}>
          <strong>{row.ticker}</strong><span>{row.name}</span><small>{row.primary_exchange}</small>
        </div>)}
      </div>
      {status && <p role="status" className="stock-search-hint">{status}</p>}
    </div>}
  </form>
}
