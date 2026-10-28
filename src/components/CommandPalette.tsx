import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { presentModal, outsideDialog } from '../lib/modal'
import { siteSearchResults, searchGroups } from '../lib/siteSearch'
import type { SearchGroup, SearchResult } from '../lib/siteSearch'
import SearchHighlight from './SearchHighlight'
import { searchCompanies, searchCompanyCount, searchCompaniesCheckedAt } from '../lib/searchCompanies'
import { dataTime } from '../utils/dataTime'
import { briefings } from '../lib/briefings'
import { stockSearchQuery } from '../lib/stockSearch'
import { useStockMatches } from '../hooks/useStockMatches'
import { isNewsFeed, readNewsSnapshot } from '../lib/newsRefresh'
import { refreshPolicies } from '../lib/refreshPolicy'
import { useResource } from '../hooks/useResource'
import { useReturnOrigin } from '../hooks/useReturnOrigin'
import { useReadArticles } from '../hooks/useReadArticles'
import { useSavedItems } from '../hooks/useSavedItems'

export default function CommandPalette({ onClose, onSelect }: { onClose: () => void; onSelect: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<SearchGroup | 'all'>('all')
  const [selection, setSelection] = useState('')
  const [newsRevision, setNewsRevision] = useState(0)
  const [snapshot] = useState(() => { try { return readNewsSnapshot(sessionStorage).latest } catch { return null } })
  const { data, loading, error } = useResource('/api/news', isNewsFeed, refreshPolicies.news, newsRevision)
  const { items } = useSavedItems()
  const { mark } = useReadArticles()
  const navigate = useNavigate()
  const returnState = useReturnOrigin()
  const listId = useId()
  const hintId = useId()
  const search = stockSearchQuery(query)
  const stockEnabled = group === 'all' || group === 'stocks'
  const { stocks, pending, failed, invalid, ready } = useStockMatches(search, stockEnabled)
  const feed = data && (!snapshot || data.fetchedAt >= snapshot.fetchedAt) ? data : snapshot
  const results = useMemo(() => siteSearchResults(query, items, briefings, feed, stocks, group, searchCompanies), [query, items, feed, stocks, group])
  const hasLocalStocks = results.some(row => row.group === 'stocks')
  const stockStatus = invalid ? group === 'stocks' ? '60자 이내의 종목명 또는 티커를 입력해 주세요.' : ''
    : pending ? '추가 종목을 검색하는 중…' : failed ? hasLocalStocks ? '외부 종목 검색에 실패했습니다. 목록에서 확인한 기업은 계속 검색할 수 있습니다.' : '종목 검색을 불러오지 못했습니다. 정확한 티커로 직접 이동하거나 다시 입력해 주세요.' : ready && !stocks.length && !hasLocalStocks ? '일치하는 종목이 없습니다.' : ''
  const visibleGroups = [...new Set(results.map(row => row.group))]

  const selected = results.find(row => row.id === selection) ?? results[0]
  const index = selected ? results.indexOf(selected) : -1
  const directTicker = search.toUpperCase()
  // Unverified input is an explicit recovery action, never a default search hit.
  const showDirect = ready && !stocks.length && !hasLocalStocks
    && /^[A-Z0-9][A-Z0-9.:-]{0,19}$/.test(directTicker) && !results.some(row => row.id === `stock:${directTicker}`)
  useEffect(() => {
    const element = dialog.current!
    const release = presentModal(element)
    input.current?.focus({ preventScroll: true })
    return release
  }, [])
  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selected?.id])
  function choose(event: React.MouseEvent<HTMLAnchorElement>, row: SearchResult) {
    if (row.external) mark(row.href)
    else if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(row.href, { state: returnState }) }
    onSelect(); onClose()
  }
  return <dialog id="site-command-menu" className="command-menu" ref={dialog} aria-label="통합 검색·빠른 이동" onCancel={event => { event.preventDefault(); onClose() }} onClose={() => close.current()}
    onClick={event => { if (event.target === event.currentTarget && outsideDialog(event, event.currentTarget.getBoundingClientRect())) onClose() }}>
    <div className="command-heading"><strong>통합 검색·빠른 이동</strong><button type="button" onClick={onClose} aria-label="검색 닫기">닫기 <kbd>Esc</kbd></button></div>
    <label className="news-sr-only" htmlFor="command-query">종목·뉴스·브리핑·저장 기사·페이지 검색</label>
    <input id="command-query" ref={input} type="text" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-describedby={hintId} aria-activedescendant={index < 0 ? undefined : `${listId}-${index}`} autoComplete="off" spellCheck={false} maxLength={120} value={query} placeholder="티커, 기사 제목, 브리핑 내용, 페이지 이름…"
      onChange={event => { setQuery(event.target.value); setSelection('') }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) { if (event.key === 'Enter') event.preventDefault(); return }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); const offset = event.key === 'ArrowDown' ? 1 : -1; setSelection(results[(index + offset + results.length) % results.length]?.id ?? '') }
        if (event.key === 'Enter') { event.preventDefault(); if (index >= 0) list.current?.querySelector<HTMLAnchorElement>(`[data-result-index="${index}"]`)?.click() }
      }} />
    <div className="command-filters" role="group" aria-label="검색 범위">{([['all', '전체'], ...searchGroups] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={group === value} onClick={() => { setGroup(value); setSelection(''); input.current?.focus({ preventScroll: true }) }}>{label}</button>)}</div>
    <div className="command-results" id={listId} role="listbox" aria-label="통합 검색 결과" ref={list}>
      {visibleGroups.map(value => {
        const label = searchGroups.find(([key]) => key === value)![1]
        const rows = results.filter(row => row.group === value)
        return rows.length ? <div role="group" aria-label={label} key={value}><p className="command-group" aria-hidden="true">{label}</p>{rows.map(row => {
          const position = results.indexOf(row)
          return <a key={row.id} id={`${listId}-${position}`} data-result-index={position} role="option" aria-selected={selected?.id === row.id} tabIndex={-1} className="command-result" href={row.href} target={row.external ? '_blank' : undefined} rel={row.external ? 'noopener noreferrer' : undefined}
            onMouseDown={event => event.preventDefault()} onMouseMove={() => setSelection(row.id)} onClick={event => choose(event, row)} onAuxClick={event => { if (event.button === 1 && row.external) mark(row.href) }}>
            <span><strong><SearchHighlight text={row.title} ranges={row.highlights} /></strong><small>{row.description}</small></span><span aria-hidden="true">{row.external ? '↗' : '↵'}</span>
          </a>
        })}</div> : null
      })}
    </div>
    {!results.length && !pending && <p className="command-notice" role="status">검색 결과가 없습니다. 검색어를 줄이거나 다른 범위를 선택해 주세요.</p>}
    {stockEnabled && query.trim() && stockStatus && <p className="command-notice" role="status">{stockStatus}</p>}
    {showDirect && <div className="command-direct-stock"><button type="button" onClick={() => {
      navigate(`/stock/${encodeURIComponent(directTicker)}`, { state: returnState }); onSelect(); onClose()
    }}>‘{directTicker}’ 티커로 직접 이동</button><small>종목 존재를 확인하지 못했습니다. 정확한 티커를 알고 있을 때 사용하세요.</small></div>}
    {(group === 'all' || group === 'news') && <p className="command-notice" role="status">{error ? <>뉴스 갱신에 실패했습니다. {data || snapshot ? '이전 수집 기사를 검색합니다.' : '다른 항목은 계속 검색할 수 있습니다.'} <button type="button" onClick={() => setNewsRevision(n => n + 1)}>뉴스 다시 조회</button></> : loading ? '최근 수집 뉴스를 확인하는 중…' : '뉴스는 최근 수집한 기사 제목·매체에서 검색합니다.'}</p>}
    {stockEnabled && <p className="command-notice">기업 목록 {searchCompanyCount}개 · 구성 확인 {dataTime(searchCompaniesCheckedAt)} · 기업명 오타도 검색할 수 있습니다.</p>}
    <p id={hintId} className="command-help">↑↓ 결과 이동 · Enter 열기 · Esc 닫기 <span>기사는 원문을 새 탭에서 엽니다.</span></p>
  </dialog>
}
