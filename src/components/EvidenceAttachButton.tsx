import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { EVIDENCE_KINDS, EVIDENCE_ROLES, parseEvidenceSource } from '../lib/evidence'
import type { EvidenceRole, EvidenceSource } from '../lib/evidence'
import { presentModal, outsideDialog } from '../lib/modal'
import { useSavedItems } from '../hooks/useSavedItems'
import './Evidence.css'

function EvidenceDialog({ source, stock, onClose }: { source: EvidenceSource; stock?: { ticker: string; name: string }; onClose: () => void }) {
  const { items, connectEvidence } = useSavedItems()
  const targets = [...new Map([...items.stocks, ...(items.theses || []).map(n => ({ ticker: n.ticker, name: n.name })), ...(stock ? [stock] : [])].map(s => [s.ticker, s])).values()]
  const [ticker, setTicker] = useState(stock?.ticker ?? '')
  const [role, setRole] = useState<EvidenceRole>('followup'), [reason, setReason] = useState('')
  const [connected, setConnected] = useState(''), [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null), select = useRef<HTMLSelectElement>(null)
  useEffect(() => { const release = presentModal(dialog.current!); select.current?.focus(); return release }, [])
  function save() {
    setError('')
    const target = targets.find(s => s.ticker === ticker)
    if (!target) { setError('연결할 종목 노트를 선택해 주세요.'); return }
    try { setConnected(connectEvidence({ ...target, source, role, reason: reason.trim() })) }
    catch (e) { setError(e instanceof Error && e.name === 'QuotaExceededError' ? '브라우저 저장 공간이 부족해 근거를 연결하지 못했습니다. 기존 노트와 자료는 유지됩니다.' : e instanceof Error ? e.message : '자료를 연결하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.') }
  }
  return <dialog ref={dialog} className="evidence-dialog" aria-label="투자 노트에 근거 연결" onCancel={e => { e.preventDefault(); onClose() }} onClick={e => { if (e.target === e.currentTarget && outsideDialog(e, e.currentTarget.getBoundingClientRect())) onClose() }}>
    <div className="evidence-dialog-heading"><h2>투자 노트에 근거 연결</h2><button type="button" onClick={onClose} aria-label="근거 연결 닫기">닫기</button></div>
    <p className="evidence-meta">{EVIDENCE_KINDS[source.kind]} · {source.publisher}</p><h3>{source.title}</h3>
    <p className="evidence-meta">자료를 연 당시의 제목·출처·수치를 저장합니다. 원문 본문은 저장하지 않습니다.</p>
    <details><summary>연결할 자료 확인</summary><a href={source.url} target="_blank" rel="noopener noreferrer">원문 확인 ↗</a>{source.period && <p>기준 기간 {source.period}</p>}{source.publishedAt && <p>발표·제출 {source.publishedAt}</p>}
      <dl className="evidence-facts">{source.facts.map((f, i) => <div key={i}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl><p className="evidence-meta">{source.caveat}</p></details>
    {source.stale && <p className="evidence-warning" role="status">갱신에 실패해 이전 확인 자료를 연결합니다. 자료 조회 시점을 확인하세요.</p>}
    {connected ? <div role="status"><p>근거 자료를 연결했습니다.</p><Link to={`/saved/thesis/${encodeURIComponent(ticker)}#evidence-${connected}`} onClick={onClose}>노트에서 확인 →</Link><button type="button" onClick={onClose}>계속 둘러보기</button></div> : <>
      <label>연결할 종목<select ref={select} aria-label="연결할 종목" value={ticker} onChange={e => setTicker(e.target.value)}><option value="">종목 노트 선택</option>{targets.map(s => <option key={s.ticker} value={s.ticker}>{s.ticker} · {s.name}</option>)}</select></label>
      {!targets.length && <p className="evidence-warning">종목 상세에서 관심 종목을 저장한 뒤 연결할 수 있습니다.</p>}
      {source.kind === '13f' && <p className="evidence-meta">이 자료의 CUSIP·주식 클래스와 연결할 종목이 맞는지 확인하세요.</p>}
      <label>근거 구분<select aria-label="근거 구분" value={role} onChange={e => setRole(e.target.value as EvidenceRole)}>{Object.entries(EVIDENCE_ROLES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>연결 이유 <small>선택 입력</small><textarea rows={3} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder="이 자료가 내 가설·위험·확인 사항과 어떻게 연결되는지" /></label>
      <button type="button" disabled={!targets.length} onClick={save}>근거 연결 저장</button>{error && <p className="evidence-warning" role="alert">{error}</p>}
    </>}
  </dialog>
}
export default function EvidenceAttachButton({ source, stock }: { source: EvidenceSource; stock?: { ticker: string; name: string } }) {
  const [opened, setOpened] = useState<EvidenceSource | null>(null), [error, setError] = useState('')
  return <span className="evidence-attach"><button type="button" className="evidence-attach-button" aria-label={`${source.title} 노트에 연결`} aria-haspopup="dialog" onClick={() => {
    try { setOpened(parseEvidenceSource(source)); setError('') } catch (e) { setError((e as Error).message) }
  }}>노트에 연결</button>{error && <small role="alert">{error}</small>}
    {opened && createPortal(<EvidenceDialog source={opened} stock={stock} onClose={() => setOpened(null)} />, document.body)}
  </span>
}
