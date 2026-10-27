import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTable } from '@tanstack/react-table'
import type { ColumnVisibilityState, SortingState } from '@tanstack/react-table'
import { DEFAULT_HOLDINGS_SORTING, HOLDING_COLUMNS, holdingTableColumns, holdingTableFeatures } from '../lib/holdingsTable'
import { HOLDING_FILTERS, csvDocument, csvIdentifier, downloadCsv, filteredHoldings, formatHoldingPercent, formatHoldingValue, holdingRows, holdingStatus } from '../lib/form13fPresentation'
import type { FilingData, HoldingFilter, HoldingRow } from '../lib/form13fPresentation'
import EvidenceAttachButton from './EvidenceAttachButton'
import { holdingEvidence } from '../lib/evidenceSources'

export function TablePagination({ page, pages, count, onPage }: { page: number; pages: number; count: number; onPage: (page: number) => void }) {
  return <nav className="holdings-pagination" aria-label="표 페이지 이동">
    <span className="tool-meta" role="status">{count ? (page - 1) * 50 + 1 : 0}–{Math.min(page * 50, count)} / {count}개 · {page} / {pages}페이지</span>
    <div><button type="button" className="tool-button" disabled={page <= 1} onClick={() => onPage(page - 1)}>이전</button>
      <button type="button" className="tool-button" disabled={page >= pages} onClick={() => onPage(page + 1)}>다음</button></div>
  </nav>
}
function HoldingCell({ column, holding: h, filing, cik }: { column: string; holding: HoldingRow; filing: FilingData; cik: string }) {
  if (column === 'name') return <div className="holding-name"><span className="holding-rank">{holdingStatus(h) === 'closed' ? '—' : h.rank}</span><div><strong>{h.name}</strong><small>{h.title} · {h.cusip}</small><EvidenceAttachButton source={holdingEvidence(filing, h, cik)} /></div></div>
  if (column === 'pct') return formatHoldingPercent(filing.totalValue ? h.value / filing.totalValue * 100 : 0)
  if (column === 'shares') return h.shares.toLocaleString('en-US')
  if (column === 'value') return formatHoldingValue(h.value)
  return holdingStatus(h) === 'closed' ? <span className="tool-negative">전량 미기재</span> : h.change.kind === 'new' ? <span className="holding-badge">신규</span> : h.change.kind === 'unknown' ? <span className="tool-meta">비교 자료 없음</span> : <span className={h.change.percent! > 0 ? 'tool-positive' : h.change.percent! < 0 ? 'tool-negative' : ''}>{h.change.percent! > 0 ? '+' : ''}{h.change.percent!.toFixed(1)}%</span>
}
export default function FullHoldingsTable({ filing, cik, query, setQuery, sort, setSort }: {
  filing: FilingData; cik: string; query: string; setQuery: (query: string) => void; sort: SortingState; setSort: (sort: SortingState) => void
}) {
  const [filter, setFilter] = useState<HoldingFilter>('current')
  const [visibility, setVisibility] = useState<ColumnVisibilityState>({})
  const [multiSort, setMultiSort] = useState(false)
  const [paging, setPaging] = useState({ scope: '', pageIndex: 0 })
  const data = useMemo(() => {
    const allowed = new Set(filteredHoldings(filing, filter).map(h => h.cusip))
    return holdingRows([...filing.holdings, ...filing.closedHoldings], filing.totalValue, query).filter(h => allowed.has(h.cusip))
  }, [filing, filter, query])
  const columns = useMemo(() => holdingTableColumns(sort), [sort])
  const scope = JSON.stringify([query, filter, sort, filing.checkedAt])
  const pageIndex = paging.scope === scope ? Math.min(paging.pageIndex, Math.max(0, Math.ceil(data.length / 50) - 1)) : 0
  const changeSort = (next: SortingState) => { setSort(next); setPaging({ scope: '', pageIndex: 0 }) }
  const table = useTable({
    features: holdingTableFeatures, columns, data, getRowId: row => row.cusip,
    state: { sorting: sort, columnVisibility: visibility, pagination: { pageIndex, pageSize: 50 } },
    onSortingChange: updater => changeSort(typeof updater === 'function' ? updater(sort) : updater),
    onColumnVisibilityChange: setVisibility,
    onPaginationChange: updater => {
      const next = typeof updater === 'function' ? updater({ pageIndex, pageSize: 50 }) : updater
      setPaging({ scope, pageIndex: next.pageIndex })
    },
    autoResetPageIndex: false, enableSortingRemoval: false, enableMultiRemove: false, maxMultiSortColCount: 3,
  })
  const rows = table.getPrePaginatedRowModel().rows.map(row => row.original)
  const visibleColumns = table.getVisibleLeafColumns()
  const changeVisibility = (id: string) => {
    const next = { ...visibility, [id]: visibility[id] === false }
    setVisibility(next)
    // A hidden column must not silently control the row order.
    if (next[id] === false && sort.some(s => s.id === id)) {
      const remaining = sort.filter(s => s.id !== id)
      const fallback = next.value !== false ? 'value' : 'name'
      changeSort(remaining.length ? remaining : [{ id: fallback, desc: fallback === 'value' }])
    }
  }
  const reset = () => {
    setQuery(''); setSort(DEFAULT_HOLDINGS_SORTING); setFilter('current'); setVisibility({}); setMultiSort(false); setPaging({ scope: '', pageIndex: 0 })
  }
  const isDefault = !query && filter === 'current' && JSON.stringify(sort) === JSON.stringify(DEFAULT_HOLDINGS_SORTING) && !Object.values(visibility).includes(false) && !multiSort && pageIndex === 0
  const exportRows = () => downloadCsv(`13f-${cik}-${filing.period}-${filter}.csv`, csvDocument([
    ['CIK', 'period', 'filed_at', 'previous_period', 'previous_available', 'stale', 'CUSIP', 'issuer', 'class', 'shares', 'previous_shares', 'value_usd', 'weight_pct', 'status', 'SEC_sources', 'previous_SEC_sources'],
    ...rows.map(h => [csvIdentifier(cik), filing.period, filing.filedAt ?? '', filing.previousPeriod, String(filing.previousAvailable), String(!!filing.stale), csvIdentifier(h.cusip), h.name, h.title,
      h.shares, h.prevShares ?? '', h.value, filing.totalValue ? h.value / filing.totalValue * 100 : 0, holdingStatus(h), filing.sources?.map(s => s.indexUrl).join(' ') ?? '', filing.previousSources?.map(s => s.indexUrl).join(' ') ?? '']),
  ]))
  return <section className="tool-card portfolio-holdings" aria-labelledby="holdings-heading">
    <div className="tool-card-heading"><h3 id="holdings-heading">전체 보유 내역</h3><span className="tool-meta" role="status">현재 공시 {filing.holdingCount.toLocaleString('ko-KR')}개</span></div>
    <div className="holdings-toolbar">
      <label className="holdings-search"><span className="tool-sr-only">보유 종목 검색</span>
        <input type="search" value={query} maxLength={120} onChange={event => { setQuery(event.target.value); setPaging({ scope: '', pageIndex: 0 }) }} placeholder="종목명·CUSIP 검색" aria-describedby="holdings-scope" /></label>
      <label className="holdings-filter"><span className="tool-sr-only">분기 변동 필터</span><select aria-label="분기 변동 필터" value={filter} onChange={e => { setFilter(e.target.value as HoldingFilter); setPaging({ scope: '', pageIndex: 0 }) }}>
        {HOLDING_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select></label>
      <button type="button" className="tool-button" onClick={reset} disabled={isDefault}>초기화</button>
      <button type="button" className="tool-button" disabled={!rows.length} onClick={exportRows}>CSV 저장 ({rows.length})</button>
    </div>
    <div className="holdings-settings">
      <button type="button" className="tool-button" aria-pressed={multiSort} aria-describedby="holdings-sort-help" onClick={() => setMultiSort(value => !value)}>다중 정렬</button>
      <details className="holdings-columns"><summary>표시할 열</summary>
        <fieldset><legend className="tool-sr-only">표시할 열 선택</legend>{table.getAllLeafColumns().map(column => <label key={column.id}>
          <input type="checkbox" checked={column.getIsVisible()} disabled={!column.getCanHide()} onChange={() => changeVisibility(column.id)} />{HOLDING_COLUMNS.find(c => c.key === column.id)!.label}{column.id === 'name' && <small>항상 표시·고정</small>}
        </label>)}</fieldset>
      </details>
    </div>
    <p className="tool-meta" id="holdings-sort-help">다중 정렬을 켜거나 Shift와 함께 열 제목을 누르면 최대 3개 기준으로 정렬합니다.</p>
    <p className="tool-meta holdings-sort-order" id="holdings-sort-order" role="status">정렬: {sort.map((s, i) => `${i + 1}. ${HOLDING_COLUMNS.find(c => c.key === s.id)!.label} ${s.desc ? '내림차순' : '오름차순'}`).join(' → ')}</p>
    <p className="tool-meta" id="holdings-scope">옵션 제외 SH 전체 내역 검색·정렬 · 50개씩 표시 · CSV는 숨긴 열을 포함한 검색·필터 결과 전체를 현재 정렬 순서로 저장합니다. 비중은 전체 수집 보유금액 기준입니다.</p>
    <p className="tool-meta">전 분기 {filing.previousPeriod}{filing.previousAvailable ? '와 수량 비교' : ' 자료를 검증하지 못해 변동을 표시하지 않습니다.'} · 신규·전량 미기재는 공시 간 차이이며 매매 확정을 뜻하지 않습니다.</p>
    <p className="tool-scroll-hint">좌우로 밀어 표 전체 보기</p>
    <div className="tool-table-scroll holdings-scroll" tabIndex={0} role="region" aria-label="기관 보유 종목 표, 좌우·상하로 스크롤">
      <table className="tool-table holdings-table" style={{ '--holding-numeric-columns': visibleColumns.length - 1 } as CSSProperties}><caption className="tool-sr-only">제목을 눌러 정렬할 수 있습니다. 수량 변화는 전 분기 대비입니다. 종목 앞 숫자는 현재 평가액 순위입니다. 종목 열은 항상 표시하며 고정합니다.</caption>
        <thead><tr>{visibleColumns.map(column => {
          const index = sort.findIndex(s => s.id === column.id), direction = column.getIsSorted()
          return <th key={column.id} scope="col" data-column={column.id} className={column.id === 'name' ? 'holding-identity' : 'tool-numeric'} aria-sort={index === 0 ? direction === 'asc' ? 'ascending' : 'descending' : undefined}>
            <button type="button" className="holding-sort" aria-describedby="holdings-sort-order" onClick={event => column.toggleSorting(undefined, multiSort || event.shiftKey)}>{HOLDING_COLUMNS.find(c => c.key === column.id)!.label}<span aria-hidden="true">{direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕'}{direction && sort.length > 1 ? ` ${index + 1}` : ''}</span></button>
          </th>
        })}</tr></thead>
        <tbody>{table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => {
          const className = cell.column.id === 'name' ? 'holding-identity' : 'tool-numeric'
          const content = <HoldingCell column={cell.column.id} holding={row.original} filing={filing} cik={cik} />
          return cell.column.id === 'name' ? <th key={cell.id} scope="row" className={className}>{content}</th> : <td key={cell.id} className={className} title={cell.column.id === 'value' ? `$${row.original.value.toLocaleString('en-US')}` : undefined}>{content}</td>
        })}</tr>)}</tbody>
      </table>
      {!rows.length && <div className="tool-empty" role="status">검색·필터와 일치하는 보유 종목이 없습니다.<button type="button" className="tool-button" onClick={reset}>전체 보유 종목 보기</button></div>}
    </div>
    <TablePagination page={pageIndex + 1} pages={Math.max(1, table.getPageCount())} count={rows.length} onPage={n => table.setPageIndex(n - 1)} />
  </section>
}
