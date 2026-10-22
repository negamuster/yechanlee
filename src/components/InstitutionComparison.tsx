import { useCallback, useState } from 'react'
import { useResource } from '../hooks/useResource'
import { refreshPolicies } from '../lib/refreshPolicy'
import { compareFilings, csvDocument, csvIdentifier, downloadCsv, formatHoldingPercent, formatHoldingValue, holdingMatchesQuery, isFiling } from '../lib/form13fPresentation'
import type { FilingData } from '../lib/form13fPresentation'
import ResourceState from './ResourceState'
import { TablePagination } from './FullHoldingsTable'
import EvidenceAttachButton from './EvidenceAttachButton'
import { comparisonEvidence } from '../lib/evidenceSources'

interface Manager { firm: string; cik: string; note?: string }
const filingUrl = (cik: string, period?: string) => `/api/form13f?cik=${cik}${period ? `&period=${period}` : ''}`

function ComparisonTable({ left, right, a, b }: { left: FilingData; right: FilingData; a: Manager; b: Manager }) {
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all'), [sort, setSort] = useState('weight')
  const [paging, setPaging] = useState({ scope: '', page: 1 })
  const all = compareFilings(left, right)
  const common = all.filter(h => h.left && h.right).length
  const rows = all.filter(h => {
    return holdingMatchesQuery({ name: `${h.name} ${h.right?.name ?? ''}`, title: `${h.title} ${h.right?.title ?? ''}`, cusip: h.cusip }, query)
      && (filter === 'all' || filter === 'common' && h.left && h.right || filter === 'left' && h.left && !h.right || filter === 'right' && h.right && !h.left)
  }).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) || a.cusip.localeCompare(b.cusip)
    : (sort === 'left' ? b.leftPct - a.leftPct : sort === 'right' ? b.rightPct - a.rightPct : sort === 'difference' ? Math.abs(b.difference) - Math.abs(a.difference) : Math.max(b.leftPct, b.rightPct) - Math.max(a.leftPct, a.rightPct)) || a.cusip.localeCompare(b.cusip))
  const scope = `${query}|${filter}|${sort}|${left.checkedAt}|${right.checkedAt}`
  const pages = Math.max(1, Math.ceil(rows.length / 50)), page = paging.scope === scope ? Math.min(paging.page, pages) : 1
  const exportRows = () => downloadCsv(`13f-compare-${a.cik}-${b.cik}-${left.period}.csv`, csvDocument([
    ['period', 'CUSIP', 'issuer', 'class_A', 'class_B', 'CIK_A', 'firm_A', 'filed_A', 'stale_A', 'shares_A', 'value_usd_A', 'weight_pct_A', 'CIK_B', 'firm_B', 'filed_B', 'stale_B', 'shares_B', 'value_usd_B', 'weight_pct_B', 'weight_difference_pp_A_minus_B', 'SEC_sources_A', 'SEC_sources_B'],
    ...rows.map(h => [left.period, csvIdentifier(h.cusip), h.name, h.left?.title ?? '', h.right?.title ?? '', csvIdentifier(a.cik), a.firm, left.filedAt ?? '', String(!!left.stale), h.left?.shares ?? 0, h.left?.value ?? 0, h.leftPct,
      csvIdentifier(b.cik), b.firm, right.filedAt ?? '', String(!!right.stale), h.right?.shares ?? 0, h.right?.value ?? 0, h.rightPct, h.difference, left.sources?.map(s => s.indexUrl).join(' ') ?? '', right.sources?.map(s => s.indexUrl).join(' ') ?? '']),
  ]))
  return <>
    <dl className="comparison-summary"><div><dt>공통 종목</dt><dd>{common}개</dd></div><div><dt>A에만 기재</dt><dd>{all.filter(h => h.left && !h.right).length}개</dd></div><div><dt>B에만 기재</dt><dd>{all.filter(h => h.right && !h.left).length}개</dd></div></dl>
    <div className="holdings-toolbar">
      <label className="holdings-search"><span className="tool-sr-only">비교 종목 검색</span><input type="search" maxLength={120} value={query} onChange={e => setQuery(e.target.value)} placeholder="종목명·CUSIP 검색" /></label>
      <label className="holdings-filter"><span className="tool-sr-only">비교 범위</span><select aria-label="비교 범위" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">전체 종목</option><option value="common">공통 종목</option><option value="left">A에만 기재</option><option value="right">B에만 기재</option></select></label>
      <label className="holdings-filter"><span className="tool-sr-only">비교 정렬</span><select aria-label="비교 정렬" value={sort} onChange={e => setSort(e.target.value)}><option value="weight">높은 비중 순</option><option value="left">A 비중 순</option><option value="right">B 비중 순</option><option value="difference">비중 차이 큰 순</option><option value="name">종목명 순</option></select></label>
      <button type="button" className="tool-button" disabled={!rows.length} onClick={exportRows}>비교 CSV 저장 ({rows.length})</button>
    </div>
    <p className="tool-meta">옵션을 제외한 SH 항목을 같은 CUSIP으로 비교합니다. 다른 주식 클래스는 별도 종목입니다. 비중은 각 기관의 수집 보유금액 기준이며 차이는 A − B입니다. 미기재는 표시 대상 SH 항목에 없다는 의미입니다.</p>
    <p className="tool-scroll-hint">좌우로 밀어 표 전체 보기</p>
    <div className="tool-table-scroll holdings-scroll" role="region" aria-label="기관 간 비교 표" tabIndex={0}>
      <table className="tool-table holdings-table comparison-table"><caption className="tool-sr-only">{left.period} 기준 두 기관의 비중, 보유 수량과 평가액</caption>
        <thead><tr><th className="holding-identity" scope="col">종목</th><th className="tool-numeric" scope="col">A 비중 · 수량 · 평가액</th><th className="tool-numeric" scope="col">B 비중 · 수량 · 평가액</th><th className="tool-numeric" scope="col">비중 차이</th></tr></thead>
        <tbody>{rows.slice((page - 1) * 50, page * 50).map(h => <tr key={h.cusip}>
          <th className="holding-identity" scope="row"><div className="holding-name"><div><strong>{h.name}</strong><small>{h.cusip} · {h.title}{h.right && h.right.title !== h.title ? ` / ${h.right.title}` : ''}</small><EvidenceAttachButton source={comparisonEvidence(left,right,h,a,b)} /></div></div></th>
          {(['left', 'right'] as const).map(side => <td key={side} className="tool-numeric">{h[side] ? <><strong>{formatHoldingPercent(side === 'left' ? h.leftPct : h.rightPct, true)}</strong><small>{h[side]!.shares.toLocaleString('en-US')}주</small><small title={`$${h[side]!.value.toLocaleString('en-US')}`}>{formatHoldingValue(h[side]!.value)}</small></> : <span className="tool-meta">미기재</span>}</td>)}
          <td className="tool-numeric">{h.difference > 0 ? '+' : ''}{h.difference.toFixed(2)}%p</td>
        </tr>)}</tbody>
      </table>{!rows.length && <p className="tool-empty" role="status">검색·필터와 일치하는 종목이 없습니다.</p>}
    </div>
    <TablePagination page={page} pages={pages} count={rows.length} onPage={n => setPaging({ scope, page: n })} />
  </>
}

function QuarterComparison({ a, b, period, latestA, latestB, revision, onRefresh }: { a: Manager; b: Manager; period: string; latestA: FilingData; latestB: FilingData; revision: number; onRefresh: () => void }) {
  const valid = useCallback((value: unknown): value is FilingData => isFiling(value) && value.period === period, [period])
  const left = useResource(filingUrl(a.cik, period === latestA.period ? undefined : period), valid, refreshPolicies.filings, revision)
  const right = useResource(filingUrl(b.cik, period === latestB.period ? undefined : period), valid, refreshPolicies.filings, revision)
  const ready = left.data?.period === period && right.data?.period === period
  return <div className="comparison-results">
    {([{ manager: a, result: left, label: 'A' }, { manager: b, result: right, label: 'B' }]).map(({ manager, result, label }) => <div className="comparison-source" key={label}>
      <strong>{label} · {manager.firm}</strong>
      {manager.note && <p className="tool-callout">{manager.note}</p>}
      <ResourceState label={`${label} 기관 공시`} loading={result.loading} error={result.error} hasData={result.data?.period === period} stale={result.data?.stale} updatedAt={result.data?.checkedAt} layout="rows" onRetry={onRefresh} />
      {result.data?.period === period && <p className="tool-meta">기준 {period} · 제출 {result.data.filedAt} · {result.data.holdingCount.toLocaleString('ko-KR')}개 · {formatHoldingValue(result.data.totalValue)} {result.data.sources?.map(s => <a key={s.accession} className="tool-text-link" href={s.indexUrl} target="_blank" rel="noopener noreferrer">공시 원문 ↗ </a>)}</p>}
    </div>)}
    {ready && left.data && right.data ? <ComparisonTable a={a} b={b} left={{ ...left.data, stale: left.data.stale || left.error }} right={{ ...right.data, stale: right.data.stale || right.error }} />
      : <p className="tool-meta" role="status">두 기관의 {period} 자료를 모두 검증한 뒤 비교합니다.</p>}
  </div>
}

export default function InstitutionComparison({ manager, managers, filing, revision, onRefresh }: { manager: Manager; managers: Manager[]; filing: FilingData; revision: number; onRefresh: () => void }) {
  const [peerCik, setPeerCik] = useState(managers.find(m => m.cik !== manager.cik)!.cik)
  const [requestedPeriod, setRequestedPeriod] = useState('')
  const peer = managers.find(m => m.cik === peerCik && m.cik !== manager.cik) ?? managers.find(m => m.cik !== manager.cik)!
  const latest = useResource(filingUrl(peer.cik), isFiling, refreshPolicies.filings, revision)
  const periods = filing.availablePeriods.filter(p => latest.data?.availablePeriods.includes(p)).sort().reverse()
  const period = periods.includes(requestedPeriod) ? requestedPeriod : periods[0]
  return <section className="tool-card institution-comparison" aria-labelledby="comparison-heading">
    <div className="tool-card-heading"><h3 id="comparison-heading">기관 간 비교</h3><button type="button" className="tool-button" onClick={onRefresh}>비교 자료 새로고침</button></div>
    <div className="comparison-controls"><label className="tool-field"><span>비교 기관 B</span><select aria-label="비교 기관 B" value={peer.cik} onChange={e => { setPeerCik(e.target.value); setRequestedPeriod('') }}>{managers.filter(m => m.cik !== manager.cik).map(m => <option key={m.cik} value={m.cik}>{m.firm}</option>)}</select></label>
      <label className="tool-field"><span>공통 보고 분기</span><select aria-label="공통 보고 분기" value={period ?? ''} disabled={!periods.length} onChange={e => setRequestedPeriod(e.target.value)}>{!periods.length && <option value="">공통 분기 확인 중</option>}{periods.map(p => <option key={p} value={p}>{p}</option>)}</select></label></div>
    <p className="tool-meta">A는 위에서 선택한 기관입니다. 각 기관의 최근 8개 보고 분기 범위에서 같은 기준일의 자료를 비교합니다.</p>
    <ResourceState label="비교 기관 분기 목록" loading={latest.loading} error={latest.error} hasData={!!latest.data} stale={latest.data?.stale} layout="rows" onRetry={onRefresh} />
    {latest.data && !periods.length && <p className="tool-callout" role="status">두 기관에 공통으로 공개된 보고 분기가 없습니다. 다른 기관을 선택해 주세요.</p>}
    {period && latest.data && <QuarterComparison key={`${manager.cik}:${peer.cik}:${period}`} a={manager} b={peer} period={period} latestA={filing} latestB={latest.data} revision={revision} onRefresh={onRefresh} />}
  </section>
}
