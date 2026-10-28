import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { refreshPolicies } from '../lib/refreshPolicy'
import { useSavedItems } from '../hooks/useSavedItems'
import { delayedCompany, formLabel, validSecMonitor } from '../lib/secMonitor'
import { dataTime } from '../utils/dataTime'
import ResourceState from './ResourceState'
import './FilingMonitor.css'

export default function FilingMonitor({ symbol }: { symbol?: string }) {
  const formId = useId(), indexId = useId()
  const [index, setIndex] = useState('all')
  const { items } = useSavedItems()
  const [revision, setRevision] = useState(0), [watchedOnly, setWatchedOnly] = useState(false), [form, setForm] = useState('all'), [query, setQuery] = useState('')
  const { data, loading, error } = useResource('/data/sec-filings.json', validSecMonitor, refreshPolicies.filings, revision)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer) }, [])
  const watched = new Set(items.stocks.map(s => s.ticker))
  const companies = (data?.companies ?? []).filter(c => symbol ? (c.aliases ?? [c.symbol]).includes(symbol) : (index === 'all' || c.indices?.includes(index)) && (!watchedOnly || (c.aliases ?? [c.symbol]).some(a => watched.has(a))) && `${(c.aliases ?? [c.symbol]).join(' ')} ${c.name}`.toLowerCase().includes(query.trim().toLowerCase()))
  const rows = companies.flatMap(c => c.filings.filter(f => form === 'all' || f.form.replace('/A', '') === form).map(f => ({ ...f, company: c }))).sort((a, b) => b.filed.localeCompare(a.filed) || b.accession.localeCompare(a.accession) || a.company.symbol.localeCompare(b.company.symbol))
  const [shown, setShown] = useState(20)
  const unsupported = watchedOnly && data ? items.stocks.filter(s => !data.companies.some(c => (c.aliases ?? [c.symbol]).includes(s.ticker))).map(s => s.ticker) : []
  const retry = () => setRevision(n => n + 1)
  return <section className="filing-monitor" aria-label={symbol ? `${symbol} SEC 공시` : 'SEC 공시 목록'}>
    <div className="filing-toolbar"><h2>SEC 공시 모니터</h2><button type="button" disabled={loading} onClick={retry}>공시 목록 새로고침</button></div>
    <p className="filing-note">SEC EDGAR · EdgarTools 수집 · 매시간 수집 예정 · 실시간 알림이 아닙니다. 최대 최근 180일(새 CIK는 확인 가능한 범위), 기업당 최신 40건까지. 새로고침은 게시된 수집본을 다시 확인합니다.</p>
    {!symbol && <div className="filing-controls"><label>기업 검색 <input type="search" value={query} maxLength={100} placeholder="티커·기업명" onChange={e => { setQuery(e.target.value); setShown(20) }} /></label><label><input type="checkbox" checked={watchedOnly} onChange={e => { setWatchedOnly(e.target.checked); setShown(20) }} />관심 종목만</label></div>}
    {!symbol && data?.universe && <div className="filing-form"><label htmlFor={indexId}>지수</label><select id={indexId} value={index} onChange={e => { setIndex(e.target.value); setShown(20) }}><option value="all">전체 대상</option><option value="sp500">S&amp;P 500</option><option value="nasdaq100">Nasdaq 100</option><option value="additional">추가 기업</option></select></div>}
    <div className="filing-form"><label htmlFor={formId}>공시 유형</label><select id={formId} value={form} onChange={e => { setForm(e.target.value); setShown(20) }}><option value="all">전체 유형</option>{['10-K', '10-Q', '8-K', '20-F', '40-F', '6-K'].map(f => <option key={f} value={f}>{f} · {formLabel(f)} (정정 포함)</option>)}</select></div>
    <ResourceState label="공시 수집본" loading={loading} error={error} hasData={!!data} onRetry={retry} />
    {data && <>
      {!symbol && <details className="filing-coverage"><summary>모니터링 대상 {data.companies.length}개 기업 · 최근 수집 시도 {dataTime(data.attemptedAt)}</summary><p>{data.companies.map(c => c.symbol).join(' · ')}</p><p>대상 밖 종목의 공시 여부는 확인하지 않습니다. 관심 목록은 이 브라우저에서만 필터링합니다.</p></details>}
      {data.universe && <p className="filing-note">구성 목록 확인: {dataTime(data.universe.checkedAt)} · S&amp;P 500 {data.universe.counts.sp500}종목 / Nasdaq 100 {data.universe.counts.nasdaq100}종목 · 중복 기업은 CIK로 통합합니다. 구성 목록은 확인일 기준이며 이후 편입·편출은 검토 후 반영합니다. {data.universe.sources.map((url, i) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">{i ? 'Nasdaq 100 목록' : 'S&P 500 목록'} ↗ </a>)}</p>}
      {!!unsupported.length && <p role="status" className="filing-warning">수집 대상 밖 관심 종목: {unsupported.join(', ')}. 공시가 없다는 의미가 아닙니다.</p>}
      {symbol && !companies.length && <p role="status">{symbol}은 현재 수집 대상에 포함되지 않습니다. <Link to="/filings">전체 수집 대상 보기</Link></p>}
      <p className="filing-note">선택 대상 {companies.length}개 기업 · 갱신 확인 {companies.filter(c => !delayedCompany(c, now)).length}개 · 지연·실패 {companies.filter(c => delayedCompany(c, now)).length}개</p>
      <details open={companies.length <= 10} className="filing-coverage"><summary>기업별 수집 상태·조회 범위</summary>
      {companies.map(c => <div className={`filing-source${delayedCompany(c, now) ? ' filing-warning' : ''}`} key={c.symbol}>
        <strong>{(c.aliases ?? [c.symbol]).join(' / ')}</strong> · {c.status === 'unavailable' ? '수집 실패 · 확인된 자료 없음' : c.status === 'stale' ? '갱신 실패 · 이전 수집본' : delayedCompany(c, now) ? '수집 지연 · 이전 수집본' : '수집 확인'}
        {c.fetchedAt && <> · 자료 수집 <time dateTime={c.fetchedAt}>{dataTime(c.fetchedAt)}</time> · 조회 범위 {c.coverageFrom} ~ {c.coverageTo}</>}
        {c.coverageFrom && c.coverageTo && Date.parse(c.coverageFrom) > Date.parse(c.coverageTo) - 180 * 86400000 && <> · 해당 CIK의 짧은 조회 범위 · 이전 CIK 공시 미포함</>}
        {c.status !== 'ok' && <> · 최근 시도 {dataTime(c.attemptedAt)}</>}
      </div>)}
      </details>
      {!rows.length && companies.length > 0 && <p role="status">{companies.some(c => delayedCompany(c, now)) ? '최신 공시 여부를 확인할 수 없습니다. 선택 조건에서 표시할 이전 공시도 없습니다.' : '확인된 수집 범위에서 선택 조건에 맞는 공시가 없습니다.'}</p>}
      {!symbol && !companies.length && <p role="status">선택 조건에 해당하는 수집 대상 기업이 없습니다.</p>}
      <p className="filing-note">제출일은 SEC 날짜이며 한국 날짜로 변환하지 않습니다. 보고 기준일과 자료 수집 시각은 별개입니다. 같은 제출일 안에서는 접수번호순이며 접수 시간순을 뜻하지 않습니다. 정정 공시는 원 공시와 별도로 표시합니다.</p>
      <ol className="filing-list">{rows.slice(0, shown).map(f => <li key={`${f.company.cik}:${f.accession}`}>
        <div className="filing-row-heading"><Link to={`/stock/${encodeURIComponent(f.company.symbol)}`}>{f.company.symbol}</Link><strong>{f.form}</strong>{f.form.endsWith('/A') && <span className="filing-amendment">정정 공시</span>}</div>
        <a className="filing-primary" href={f.url} target="_blank" rel="noopener noreferrer">{formLabel(f.form)} · SEC 원문 ↗</a>
        <p>제출일 <time dateTime={f.filed}>{f.filed}</time> · 보고 기준일 {f.reportDate ?? '미제공'}</p>
        <small>접수번호 {f.accession} · 기업 CIK {f.company.cik}{delayedCompany(f.company, now) ? ' · 이전 수집본' : ''}</small>
      </li>)}</ol>
      {rows.length > shown && <button type="button" className="filing-more" onClick={() => setShown(n => n + 20)}>공시 더보기 ({rows.length - shown}건 남음)</button>}
    </>}
    {symbol && <Link className="filing-all" to="/filings">전체 공시 모니터 →</Link>}
  </section>
}
