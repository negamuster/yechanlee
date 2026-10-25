import { useReturnOrigin } from '../hooks/useReturnOrigin'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { stockSearchQuery } from '../lib/stockSearch'
import { useStockMatches } from '../hooks/useStockMatches'
export default function StockSearch({ onSelect }: { onSelect: () => void }) {
  const [query, setQuery] = useState('')
  const [opened, setOpened] = useState(false)
  const [active, setActive] = useState(-1)
  const [status, setStatus] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const returnState = useReturnOrigin()
  const search = stockSearchQuery(query)
  const { stocks: matches, pending, failed, invalid, ready } = useStockMatches(search, opened)
  const searchStatus = status || (pending ? '검색 중…' : invalid && search ? '60자 이내의 종목명 또는 티커를 입력해 주세요.' : failed ? '검색을 불러오지 못했습니다. 정확한 티커를 입력하고 Enter를 눌러 주세요.' : ready && !matches.length ? '검색 결과가 없습니다. 영문 회사명이나 티커를 입력해 주세요.' : '')
  function select(ticker: string) { setQuery(ticker); setOpened(false); input.current?.blur(); navigate(`/stock/${encodeURIComponent(ticker)}`, { state: returnState }); onSelect() }
  return <form className="site-search" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) { setOpened(false); setActive(-1) } }} onSubmit={e => {
    e.preventDefault()
    const selected = matches[active] || matches.find(row => row.ticker === search.toUpperCase())
    if (selected) select(selected.ticker)
    else if (/^[A-Z0-9][A-Z0-9.:-]{0,19}$/i.test(search)) select(search.toUpperCase())
    else { setOpened(true); setStatus('검색 결과에서 원하는 종목을 선택해 주세요.') }
  }}>
    <label className="news-sr-only" htmlFor="site-stock-search">미국 종목명 또는 티커 검색</label>
    <input ref={input} id="site-stock-search" role="combobox" aria-autocomplete="list" aria-expanded={opened && !!query.trim()} aria-controls="stock-search-options"
      aria-activedescendant={active >= 0 && opened ? `stock-option-${active}` : undefined}
      autoComplete="off" maxLength={60} value={query} placeholder="티커·종목명 검색"
      onFocus={() => { setOpened(true); setActive(-1); setStatus('') }} onChange={e => { setQuery(e.target.value); setOpened(true); setStatus(''); setActive(-1) }}
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
      {searchStatus && <p role="status" className="stock-search-hint">{searchStatus}</p>}
    </div>}
  </form>
}

