import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSessionState } from '../hooks/useSessionState'
import { defaultEvidenceFilters, findEvidence, validEvidenceFilters } from '../lib/noteDiscovery'
import { EVIDENCE_KINDS, EVIDENCE_ROLES } from '../lib/evidence'
import type { Evidence } from '../lib/evidence'
import { useSavedItems } from '../hooks/useSavedItems'
import './Evidence.css'

const time = (value: string) => /^\d{4}-\d\d-\d\d$/.test(value) ? value : new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false }) + ' KST'
function EvidenceCard({ evidence: e, onArchive, linkable = false }: { evidence: Evidence; onArchive?: () => void; linkable?: boolean }) {
  return <article className="evidence-card" id={linkable ? `evidence-${e.id}` : undefined}>
    <div className="evidence-tags"><span>{EVIDENCE_KINDS[e.kind]}</span><span>{EVIDENCE_ROLES[e.role]}</span>{e.archivedAt && <span>보관됨</span>}{e.stale && <span>이전 확인 자료</span>}</div>
    <h3><a href={e.url} target="_blank" rel="noopener noreferrer">{e.title} ↗</a></h3>
    <p className="evidence-meta">{e.publisher}{e.period && ` · 기준 ${e.period}`}{e.publishedAt && ` · 발표·제출 ${time(e.publishedAt)}`}</p>
    <p className="evidence-meta">연결 {time(e.attachedAt)}{e.observedAt && ` · 자료 조회·기준 ${time(e.observedAt)}`}</p>
    {e.reason && <p className="evidence-reason">연결 이유: {e.reason}</p>}
    {!!e.facts.length && <dl className="evidence-facts">{e.facts.map((f, i) => <div key={i}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>}
    <p className="evidence-meta">{e.caveat}</p>
    {!!e.links.length && <details><summary>연결 당시 출처·계산 근거 ({e.links.length})</summary><ul>{e.links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noopener noreferrer">{l.label} ↗</a></li>)}</ul></details>}
    {onArchive && <button type="button" onClick={onArchive}>{e.archivedAt ? '근거 목록에 복원' : '근거 보관'}</button>}
  </article>
}
export function EvidenceHistory({ evidence }: { evidence: Evidence[] }) {
  const [open, setOpen] = useState(false)
  return <details className="evidence-history-links" onToggle={event => setOpen(event.currentTarget.open)}><summary>이 판단에 연결한 근거 ({evidence.length})</summary>
    {open && evidence.map(e => <EvidenceCard key={e.id} evidence={e} />)}
  </details>
}
export default function ThesisEvidence({ ticker, evidence }: { ticker: string; evidence: Evidence[] }) {
  const { setEvidenceArchived } = useSavedItems()
  const { hash } = useLocation()
  const [filters, setFilters] = useSessionState(`thesis.${ticker}.evidenceFilters`, defaultEvidenceFilters, validEvidenceFilters)
  const [error, setError] = useState('')
  const active = evidence.filter(e => !e.archivedAt), visible = findEvidence(evidence, filters)
  const linked = evidence.find(e => hash === `#evidence-${e.id}`)
  const outside = linked && !visible.some(e => e.id === linked.id) ? linked : null
  function archive(e: Evidence) { try { setEvidenceArchived(ticker, e.id, !e.archivedAt); setError('') } catch (error) { setError((error as Error).message) } }
  return <section aria-labelledby="thesis-evidence-heading"><h2 id="thesis-evidence-heading">연결된 근거 자료 <small>{active.length}개 · 보관 포함 {evidence.length}/100</small></h2>
    <p className="thesis-help">뉴스·SEC 재무·Daily Briefing·13F의 ‘노트에 연결’로 추가합니다. 연결 당시 내용은 자동 갱신되지 않습니다. 보관한 자료도 과거 판단 이력과 백업에 남습니다.</p>
    {!!evidence.length && <><div className="research-filters" role="group" aria-label="근거 자료 검색과 필터">
      <label className="research-query">근거 검색<input type="search" maxLength={120} placeholder="제목·출처·연결 이유" value={filters.query} onChange={e => setFilters({ ...filters, query: e.target.value })} /></label>
      <label>자료 유형<select value={filters.kind} onChange={e => setFilters({ ...filters, kind: e.target.value as typeof filters.kind })}><option value="all">전체 유형</option>{Object.entries(EVIDENCE_KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>근거 역할<select value={filters.role} onChange={e => setFilters({ ...filters, role: e.target.value as typeof filters.role })}><option value="all">전체 역할</option>{Object.entries(EVIDENCE_ROLES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>보관 상태<select value={filters.archive} onChange={e => setFilters({ ...filters, archive: e.target.value as typeof filters.archive })}><option value="active">활성 자료</option><option value="archived">보관된 자료</option><option value="all">보관 포함 전체</option></select></label>
      <label>근거 정렬<select value={filters.sort} onChange={e => setFilters({ ...filters, sort: e.target.value as typeof filters.sort })}><option value="newest">연결일 최신순</option><option value="oldest">연결일 오래된순</option></select></label>
      <button type="button" onClick={() => setFilters(defaultEvidenceFilters())}>근거 조건 초기화</button>
    </div><p className="thesis-help" role="status">근거 {visible.length}개 표시 · 보관 포함 전체 {evidence.length}개</p></>}
    {error && <p className="thesis-error" role="alert">{error}</p>}
    {outside && <div className="evidence-linked"><p className="thesis-help">바로 연결한 근거입니다. 현재 검색·필터 조건과 별도로 표시합니다.</p><EvidenceCard evidence={outside} onArchive={() => archive(outside)} linkable /></div>}
    {visible.length ? <ul className="evidence-list">{visible.map(e => <li key={e.id}><EvidenceCard evidence={e} onArchive={() => archive(e)} linkable /></li>)}</ul> : <p className="thesis-help">{evidence.length ? '조건에 맞는 근거 자료가 없습니다. 검색어나 필터를 바꿔보세요.' : '연결된 근거 자료가 없습니다.'}</p>}
  </section>
}
