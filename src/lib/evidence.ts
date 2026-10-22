export const EVIDENCE_KINDS = { news: '뉴스', filing: 'SEC 재무 공시', briefing: 'Daily Briefing', '13f': '13F 공시' } as const
export const EVIDENCE_ROLES = { support: '투자 근거', counter: '반대 근거', followup: '추가 확인' } as const
export type EvidenceRole = keyof typeof EVIDENCE_ROLES
export type EvidenceSource = {
  kind: keyof typeof EVIDENCE_KINDS; title: string; url: string; publisher: string
  publishedAt?: string; period?: string; observedAt?: string; stale: boolean
  facts: { label: string; value: string }[]; links: { label: string; url: string }[]; caveat: string
}
export type Evidence = EvidenceSource & { id: string; attachedAt: string; role: EvidenceRole; reason: string; archivedAt?: string }
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max
const required = (v: unknown, max: number): v is string => text(v, max) && !!v.trim()
const calendarDate = (v: string) => /^\d{4}-\d\d-\d\d$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0,10) === v
const instant = (v: unknown): v is string => text(v, 40) && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(v) && calendarDate(v.slice(0,10)) && Number.isFinite(Date.parse(v))
export function evidenceUrl(value: unknown): string {
  if (!required(value, 4000)) throw new Error('근거 자료의 원문 링크가 올바르지 않습니다.')
  let url: URL
  try { url = new URL(value) } catch { throw new Error('근거 자료의 원문 링크가 올바르지 않습니다.') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('근거 자료에는 http·https 원문 링크만 연결할 수 있습니다.')
  return url.href
}
export function parseEvidenceSource(value: unknown): EvidenceSource {
  const s = value as EvidenceSource | null
  if (!s || !Object.hasOwn(EVIDENCE_KINDS, s.kind) || !required(s.title, 1000) || !required(s.publisher, 300)
    || typeof s.stale !== 'boolean' || !text(s.caveat, 2500) || !Array.isArray(s.facts) || s.facts.length > 24
    || !Array.isArray(s.links) || s.links.length > 30 || (s.period !== undefined && !required(s.period, 150))
    || (s.observedAt !== undefined && !instant(s.observedAt))
    || (s.publishedAt !== undefined && (!text(s.publishedAt, 40) || !calendarDate(s.publishedAt) && !instant(s.publishedAt)))) throw new Error('올바르지 않은 근거 자료입니다.')
  return { kind: s.kind, title: s.title, url: evidenceUrl(s.url), publisher: s.publisher,
    ...(s.publishedAt ? { publishedAt: s.publishedAt } : {}), ...(s.period ? { period: s.period } : {}), ...(s.observedAt ? { observedAt: s.observedAt } : {}),
    stale: s.stale, caveat: s.caveat,
    facts: s.facts.map(f => { if (!f || !required(f.label, 150) || !required(f.value, 1000)) throw new Error('올바르지 않은 근거 수치입니다.'); return { label: f.label, value: f.value } }),
    links: s.links.map(l => { if (!l || !required(l.label, 300)) throw new Error('올바르지 않은 근거 출처입니다.'); return { label: l.label, url: evidenceUrl(l.url) } }),
  }
}
export function parseEvidence(value: unknown): Evidence[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('근거 자료는 보관 자료를 포함해 노트당 100개까지 연결할 수 있습니다.')
  const ids = new Set<string>()
  return value.map((raw: Evidence) => {
    const source = parseEvidenceSource(raw)
    if (!required(raw.id,100) || !/^[\w-]{1,100}$/.test(raw.id) || ids.has(raw.id) || !instant(raw.attachedAt) || !Object.hasOwn(EVIDENCE_ROLES, raw.role) || !text(raw.reason, 1000)
      || (raw.archivedAt !== undefined && !instant(raw.archivedAt))) throw new Error('올바르지 않은 근거 연결 기록입니다.')
    ids.add(raw.id)
    return { ...source, id: raw.id, attachedAt: raw.attachedAt, role: raw.role, reason: raw.reason, ...(raw.archivedAt ? { archivedAt: raw.archivedAt } : {}) }
  })
}
export function evidenceFingerprint(e: Evidence) {
  return JSON.stringify({ ...parseEvidenceSource(e), role: e.role, reason: e.reason })
}
