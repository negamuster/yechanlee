import type { Thesis } from './thesis.ts'
import { JUDGMENTS } from './thesis.ts'
import type { Evidence } from './evidence.ts'
import { EVIDENCE_KINDS, EVIDENCE_ROLES } from './evidence.ts'

export const REVIEW_FILTERS = { all: '전체 확인일', due: '오늘까지 확인 예정', upcoming: '내일부터 7일 이내', none: '확인일 미설정' } as const
export type NoteFilters = { query: string; judgment: 'all' | 'none' | keyof typeof JUDGMENTS; review: keyof typeof REVIEW_FILTERS }
export const defaultNoteFilters = (): NoteFilters => ({ query: '', judgment: 'all', review: 'all' })
export type EvidenceFilters = { query: string; kind: 'all' | Evidence['kind']; role: 'all' | Evidence['role']; archive: 'active' | 'archived' | 'all'; sort: 'newest' | 'oldest' }
export const defaultEvidenceFilters = (): EvidenceFilters => ({ query: '', kind: 'all', role: 'all', archive: 'active', sort: 'newest' })
const has = (o: object, v: unknown) => typeof v === 'string' && Object.hasOwn(o, v)
const queryValid = (v: unknown) => typeof v === 'string' && v.length <= 120
export function validNoteFilters(value: unknown): boolean {
  const f = value as NoteFilters | null
  return !!f && queryValid(f.query) && (['all', 'none'].includes(f.judgment) || has(JUDGMENTS, f.judgment)) && has(REVIEW_FILTERS, f.review)
}
export function validEvidenceFilters(value: unknown): boolean {
  const f = value as EvidenceFilters | null
  return !!f && queryValid(f.query) && (f.kind === 'all' || has(EVIDENCE_KINDS, f.kind)) && (f.role === 'all' || has(EVIDENCE_ROLES, f.role)) && ['active', 'archived', 'all'].includes(f.archive) && ['newest', 'oldest'].includes(f.sort)
}
const normalize = (s: string) => s.normalize('NFKC').toLowerCase()
function matches(values: string[], query: string) {
  const haystack = normalize(values.join(' '))
  return normalize(query).trim().split(/\s+/).every(word => haystack.includes(word))
}
export function koreanToday(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10)
}
export function findNotes(notes: readonly Thesis[], filters: NoteFilters, today = koreanToday()): Thesis[] {
  const end = new Date(`${today}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 7)
  const upcomingEnd = end.toISOString().slice(0, 10)
  return notes.filter(n => {
    const judgment = n.history.at(-1)?.judgment ?? 'none'
    return (filters.judgment === 'all' || judgment === filters.judgment)
      && (filters.review === 'all' || filters.review === 'none' && !n.reviewDate || filters.review === 'due' && !!n.reviewDate && n.reviewDate <= today || filters.review === 'upcoming' && n.reviewDate > today && n.reviewDate <= upcomingEnd)
      && matches([n.ticker, n.name, ...n.reasons, n.counter, n.next, ...n.history.map(h => h.reason)], filters.query)
  }).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}
export function findEvidence(evidence: readonly Evidence[], filters: EvidenceFilters): Evidence[] {
  return evidence.filter(e => (filters.kind === 'all' || e.kind === filters.kind)
    && (filters.role === 'all' || e.role === filters.role)
    && (filters.archive === 'all' || Boolean(e.archivedAt) === (filters.archive === 'archived'))
    && matches([e.title, e.publisher, e.reason], filters.query))
    .sort((a, b) => (Date.parse(a.attachedAt) - Date.parse(b.attachedAt)) * (filters.sort === 'newest' ? -1 : 1))
}
