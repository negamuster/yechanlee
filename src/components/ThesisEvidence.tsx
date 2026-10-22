import { useState } from 'react'
import { EVIDENCE_KINDS, EVIDENCE_ROLES } from '../lib/evidence'
import type { Evidence } from '../lib/evidence'
import { useSavedItems } from './SavedItemsProvider'
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
  const [error, setError] = useState('')
  const active = evidence.filter(e => !e.archivedAt), archived = evidence.filter(e => e.archivedAt)
  function archive(e: Evidence) { try { setEvidenceArchived(ticker, e.id, !e.archivedAt); setError('') } catch (error) { setError((error as Error).message) } }
  return <section aria-labelledby="thesis-evidence-heading"><h2 id="thesis-evidence-heading">연결된 근거 자료 <small>{active.length}개 · 보관 포함 {evidence.length}/100</small></h2>
    <p className="thesis-help">뉴스·SEC 재무·Daily Briefing·13F의 ‘노트에 연결’로 추가합니다. 연결 당시 내용은 자동 갱신되지 않습니다. 보관한 자료도 과거 판단 이력과 백업에 남습니다.</p>
    {error && <p className="thesis-error" role="alert">{error}</p>}
    {active.length ? <ul className="evidence-list">{[...active].reverse().map(e => <li key={e.id}><EvidenceCard evidence={e} onArchive={() => archive(e)} linkable /></li>)}</ul> : <p className="thesis-help">연결된 근거 자료가 없습니다.</p>}
    {!!archived.length && <details><summary>보관된 자료 ({archived.length})</summary><ul className="evidence-list">{archived.map(e => <li key={e.id}><EvidenceCard evidence={e} onArchive={() => archive(e)} /></li>)}</ul></details>}
  </section>
}
