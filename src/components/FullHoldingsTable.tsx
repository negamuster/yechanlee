import { useState } from 'react'
import { DEFAULT_HOLDING_SORT, HOLDING_FILTERS, csvDocument, csvIdentifier, downloadCsv, filteredHoldings, formatHoldingPercent, formatHoldingValue, holdingRows, holdingStatus, nextHoldingSort } from '../lib/form13fPresentation'
import type { FilingData, HoldingFilter, HoldingSort, HoldingSortKey } from '../lib/form13fPresentation'
import EvidenceAttachButton from './EvidenceAttachButton'
import { holdingEvidence } from '../lib/evidenceSources'

export function TablePagination({ page, pages, count, onPage }: { page: number; pages: number; count: number; onPage: (page: number) => void }) {
  return <nav className="holdings-pagination" aria-label="표 페이지 이동">
    <span className="tool-meta" role="status">{count ? (page - 1) * 50 + 1 : 0}–{Math.min(page * 50, count)} / {count}개 · {page} / {pages}페이지</span>
    <div><button type="button" className="tool-button" disabled={page <= 1} onClick={() => onPage(page - 1)}>이전</button>
      <button type="button" className="tool-button" disabled={page >= pages} onClick={() => onPage(page + 1)}>다음</button></div>
  </nav>
}
const COLUMNS: { key: HoldingSortKey; label: string }[] = [
  { key: 'name', label: '종목' }, { key: 'pct', label: '비중' }, { key: 'shares', label: '보유 수량' },
  { key: 'value', label: '평가액' }, { key: 'change', label: '수량 변화' },
]
export default function FullHoldingsTable({ filing, cik, query, setQuery, sort, setSort }: {
  filing: FilingData; cik: string; query: string; setQuery: (query: string) => void; sort: HoldingSort; setSort: (sort: HoldingSort) => void
}) {
  const [filter, setFilter] = useState<HoldingFilter>('current')
  const [paging, setPaging] = useState({ scope: '', page: 1 })
  const allowed = new Set(filteredHoldings(filing, filter).map(h => h.cusip))
  const rows = holdingRows([...filing.holdings, ...filing.closedHoldings], filing.totalValue, query, sort).filter(h => allowed.has(h.cusip))
  const scope = `${query}|${filter}|${sort.key}|${sort.direction}|${filing.checkedAt}`
  const pages = Math.max(1, Math.ceil(rows.length / 50))
  const page = paging.scope === scope ? Math.min(paging.page, pages) : 1
  const reset = () => { setQuery(''); setSort(DEFAULT_HOLDING_SORT); setFilter('current') }
  const exportRows = () => downloadCsv(`13f-${cik}-${filing.period}-${filter}.csv`, csvDocument([
    ['CIK', 'period', 'filed_at', 'previous_period', 'previous_available', 'stale', 'CUSIP', 'issuer', 'class', 'shares', 'previous_shares', 'value_usd', 'weight_pct', 'status', 'SEC_sources', 'previous_SEC_sources'],
    ...rows.map(h => [csvIdentifier(cik), filing.period, filing.filedAt ?? '', filing.previousPeriod, String(filing.previousAvailable), String(!!filing.stale), csvIdentifier(h.cusip), h.name, h.title,
      h.shares, h.prevShares ?? '', h.value, filing.totalValue ? h.value / filing.totalValue * 100 : 0, holdingStatus(h), filing.sources?.map(s => s.indexUrl).join(' ') ?? '', filing.previousSources?.map(s => s.indexUrl).join(' ') ?? '']),
  ]))
  return <section className="tool-card portfolio-holdings" aria-labelledby="holdings-heading">
    <div className="tool-card-heading"><h3 id="holdings-heading">전체 보유 내역</h3><span className="tool-meta" role="status">현재 공시 {filing.holdingCount.toLocaleString('ko-KR')}개</span></div>
    <div className="holdings-toolbar">
      <label className="holdings-search"><span className="tool-sr-only">보유 종목 검색</span>
        <input type="search" value={query} maxLength={120} onChange={event => setQuery(event.target.value)} placeholder="종목명·CUSIP 검색" aria-describedby="holdings-scope" /></label>
      <label className="holdings-filter"><span className="tool-sr-only">분기 변동 필터</span><select aria-label="분기 변동 필터" value={filter} onChange={e => setFilter(e.target.value as HoldingFilter)}>
        {HOLDING_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select></label>
      <button type="button" className="tool-button" onClick={reset} disabled={!query && filter === 'current' && sort.key === 'value' && sort.direction === 'desc'}>초기화</button>
      <button type="button" className="tool-button" disabled={!rows.length} onClick={exportRows}>CSV 저장 ({rows.length})</button>
    </div>
    <p className="tool-meta" id="holdings-scope">옵션 제외 SH 전체 내역 검색·정렬 · 50개씩 표시 · CSV는 검색·필터 결과 전체를 저장합니다. 비중은 전체 수집 보유금액 기준입니다.</p>
    <p className="tool-meta">전 분기 {filing.previousPeriod}{filing.previousAvailable ? '와 수량 비교' : ' 자료를 검증하지 못해 변동을 표시하지 않습니다.'} · 신규·전량 미기재는 공시 간 차이이며 매매 확정을 뜻하지 않습니다.</p>
    <p className="tool-scroll-hint">좌우로 밀어 표 전체 보기</p>
    <div className="tool-table-scroll holdings-scroll" tabIndex={0} role="region" aria-label="기관 보유 종목 표, 좌우·상하로 스크롤">
      <table className="tool-table holdings-table"><caption className="tool-sr-only">제목을 눌러 정렬할 수 있습니다. 수량 변화는 전 분기 대비입니다. 종목 앞 숫자는 현재 평가액 순위입니다.</caption>
        <thead><tr>{COLUMNS.map(column => <th key={column.key} scope="col" className={column.key === 'name' ? 'holding-identity' : 'tool-numeric'} aria-sort={sort.key === column.key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}>
          <button type="button" className="holding-sort" onClick={() => setSort(nextHoldingSort(sort, column.key))}>{column.label}<span aria-hidden="true">{sort.key === column.key ? sort.direction === 'asc' ? '↑' : '↓' : '↕'}</span></button>
        </th>)}</tr></thead>
        <tbody>{rows.slice((page - 1) * 50, page * 50).map(h => <tr key={h.cusip}>
          <th scope="row" className="holding-identity"><div className="holding-name"><span className="holding-rank">{holdingStatus(h) === 'closed' ? '—' : h.rank}</span><div><strong>{h.name}</strong><small>{h.title} · {h.cusip}</small><EvidenceAttachButton source={holdingEvidence(filing,h,cik)} /></div></div></th>
          <td className="tool-numeric">{formatHoldingPercent(filing.totalValue ? h.value / filing.totalValue * 100 : 0)}</td><td className="tool-numeric">{h.shares.toLocaleString('en-US')}</td>
          <td className="tool-numeric" title={`$${h.value.toLocaleString('en-US')}`}>{formatHoldingValue(h.value)}</td>
          <td className="tool-numeric">{holdingStatus(h) === 'closed' ? <span className="tool-negative">전량 미기재</span> : h.change.kind === 'new' ? <span className="holding-badge">신규</span> : h.change.kind === 'unknown' ? <span className="tool-meta">비교 자료 없음</span> : <span className={h.change.percent! > 0 ? 'tool-positive' : h.change.percent! < 0 ? 'tool-negative' : ''}>{h.change.percent! > 0 ? '+' : ''}{h.change.percent!.toFixed(1)}%</span>}</td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <div className="tool-empty" role="status">검색·필터와 일치하는 보유 종목이 없습니다.<button type="button" className="tool-button" onClick={reset}>전체 보유 종목 보기</button></div>}
    </div>
    <TablePagination page={page} pages={pages} count={rows.length} onPage={n => setPaging({ scope, page: n })} />
  </section>
}
