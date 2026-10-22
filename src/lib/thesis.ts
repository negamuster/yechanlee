import { evidenceFingerprint, parseEvidence } from './evidence.ts'
import type { Evidence } from './evidence.ts'
export const JUDGMENTS = { strengthen: '강화', maintain: '유지', weaken: '약화', pending: '판단 보류' } as const
export type Judgment = keyof typeof JUDGMENTS
export type ThesisFields = { reasons: [string, string, string]; counter: string; next: string; reviewDate: string }
export type ThesisEntry = { id: string; at: string; judgment: Judgment; reason: string; evidenceIds?: string[] }
export type Thesis = ThesisFields & { ticker: string; name: string; revision: string; createdAt: string; updatedAt: string; history: ThesisEntry[]; evidence?: Evidence[] }
export const blankFields = (): ThesisFields => ({ reasons: ['', '', ''], counter: '', next: '', reviewDate: '' })
export function thesisRevisionMatches(note: Thesis | undefined, baseRevision: string | null): boolean {
  return (note?.revision ?? null) === baseRevision || !!(baseRevision === null && note?.revision.startsWith('evidence:') && !note.history.length && note.reasons.every(r => !r) && !note.counter && !note.next && !note.reviewDate)
}
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max
const timestamp = (v: unknown): v is string => text(v, 40) && Number.isFinite(Date.parse(v))
export function validFields(v: unknown): v is ThesisFields {
  const f = v as ThesisFields | null
  return !!f && Array.isArray(f.reasons) && f.reasons.length === 3 && f.reasons.every(r => text(r, 2000)) && text(f.counter, 2000) && text(f.next, 2000) && text(f.reviewDate, 10) && (!f.reviewDate || /^\d{4}-\d{2}-\d{2}$/.test(f.reviewDate) && Number.isFinite(Date.parse(f.reviewDate)) && new Date(f.reviewDate).toISOString().slice(0,10) === f.reviewDate)
}
export function parseTheses(value: unknown): Thesis[] {
  if (!Array.isArray(value) || value.length > 50) throw new Error('투자 노트는 최대 50개까지 저장할 수 있습니다.')
  const tickers = new Set<string>()
  return value.map((raw: unknown) => {
    const n = raw as Thesis
    if (!n || !validFields(n) || !text(n.ticker,20) || !/^[A-Z0-9][A-Z0-9.-]*$/.test(n.ticker) || tickers.has(n.ticker) || !text(n.name,300) || !n.name || !text(n.revision,100) || !n.revision || !timestamp(n.createdAt) || !timestamp(n.updatedAt) || !Array.isArray(n.history) || n.history.length > 100) throw new Error('올바르지 않은 투자 노트입니다.')
    tickers.add(n.ticker)
    const evidence = n.evidence !== undefined ? parseEvidence(n.evidence) : undefined
    const evidenceIds = new Set(evidence?.map(e => e.id))
    const ids = new Set<string>()
    const history = n.history.map((h: ThesisEntry) => {
      if (!h || !text(h.id,100) || !h.id || ids.has(h.id) || !timestamp(h.at) || !Object.hasOwn(JUDGMENTS,h.judgment) || !text(h.reason,1000) || !h.reason.trim()) throw new Error('올바르지 않은 판단 이력입니다.')
      if (h.evidenceIds !== undefined && (!Array.isArray(h.evidenceIds) || h.evidenceIds.length > 20 || new Set(h.evidenceIds).size !== h.evidenceIds.length || h.evidenceIds.some(id => !evidenceIds.has(id)))) throw new Error('판단 이력의 근거 자료를 찾을 수 없습니다.')
      ids.add(h.id); return { id:h.id, at:h.at, judgment:h.judgment, reason:h.reason, ...(h.evidenceIds !== undefined ? { evidenceIds: [...h.evidenceIds] } : {}) }
    })
    return { ticker:n.ticker, name:n.name, revision:n.revision, createdAt:n.createdAt, updatedAt:n.updatedAt, reasons:[...n.reasons] as ThesisFields['reasons'], counter:n.counter, next:n.next, reviewDate:n.reviewDate, history, ...(evidence !== undefined ? { evidence } : {}) }
  })
}
export function saveThesis(notes: Thesis[], input: {ticker:string;name:string;fields:ThesisFields;baseRevision:string|null;entry?:{judgment:Judgment;reason:string;evidenceIds?:string[]}}, revision:string, at:string): Thesis[] {
  const old = notes.find(n => n.ticker === input.ticker)
  if (!thesisRevisionMatches(old, input.baseRevision)) throw new Error('다른 탭에서 이 노트가 변경되었습니다. 작성 중인 내용을 복사한 뒤 페이지를 새로고침해 최신 노트를 확인하세요.')
  const history = [...(old?.history || [])]
  if (input.entry?.evidenceIds?.some(id => !old?.evidence?.some(e => e.id === id && !e.archivedAt))) throw new Error('선택한 근거가 보관되거나 변경되었습니다. 연결 자료를 다시 선택해 주세요.')
  if (input.entry) history.push({ id:revision, at, ...input.entry })
  const next = { ...input.fields, ticker:input.ticker, name:input.name, revision, createdAt:old?.createdAt || at, updatedAt:at, history, ...(old?.evidence !== undefined ? { evidence: old.evidence } : {}) }
  return parseTheses(old ? notes.map(n => n.ticker === input.ticker ? next : n) : [...notes,next])
}

export function attachEvidence(notes: Thesis[], input: { ticker: string; name: string; evidence: Evidence }, revision: string): { notes: Thesis[]; id: string } {
  const evidence = parseEvidence([input.evidence])[0]
  const old = notes.find(n => n.ticker === input.ticker)
  const duplicate = old?.evidence?.find(e => evidenceFingerprint(e) === evidenceFingerprint(evidence))
  const id = duplicate?.id ?? evidence.id
  const existing = old?.evidence ?? []
  const nextEvidence = duplicate ? existing.map(e => { if (e.id !== id) return e; const active = { ...e }; delete active.archivedAt; return active }) : [...existing, evidence]
  // Attaching evidence never replaces a prose draft's revision or fields. saveThesis reads this latest list.
  const next: Thesis = old ? { ...old, evidence: nextEvidence, updatedAt: evidence.attachedAt } : { ...blankFields(), ticker: input.ticker, name: input.name, revision: `evidence:${revision}`, createdAt: evidence.attachedAt, updatedAt: evidence.attachedAt, history: [], evidence: nextEvidence }
  return { notes: parseTheses(old ? notes.map(n => n.ticker === input.ticker ? next : n) : [...notes, next]), id }
}
export function archiveEvidence(notes: Thesis[], ticker: string, id: string, at: string, archive: boolean): Thesis[] {
  const note = notes.find(n => n.ticker === ticker)
  if (!note?.evidence?.some(e => e.id === id)) throw new Error('연결된 근거 자료를 찾을 수 없습니다.')
  return parseTheses(notes.map(n => n !== note ? n : { ...n, updatedAt: at, evidence: n.evidence!.map(e => {
    if (e.id !== id) return e
    const source = { ...e }; delete source.archivedAt
    return archive ? { ...source, archivedAt: at } : source
  }) }))
}
