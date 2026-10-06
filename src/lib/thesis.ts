export const JUDGMENTS = { strengthen: '강화', maintain: '유지', weaken: '약화', pending: '판단 보류' } as const
export type Judgment = keyof typeof JUDGMENTS
export type ThesisFields = { reasons: [string, string, string]; counter: string; next: string; reviewDate: string }
export type ThesisEntry = { id: string; at: string; judgment: Judgment; reason: string }
export type Thesis = ThesisFields & { ticker: string; name: string; revision: string; createdAt: string; updatedAt: string; history: ThesisEntry[] }
export const blankFields = (): ThesisFields => ({ reasons: ['', '', ''], counter: '', next: '', reviewDate: '' })
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
    const ids = new Set<string>()
    const history = n.history.map((h: ThesisEntry) => {
      if (!h || !text(h.id,100) || !h.id || ids.has(h.id) || !timestamp(h.at) || !Object.hasOwn(JUDGMENTS,h.judgment) || !text(h.reason,1000) || !h.reason.trim()) throw new Error('올바르지 않은 판단 이력입니다.')
      ids.add(h.id); return { id:h.id, at:h.at, judgment:h.judgment, reason:h.reason }
    })
    return { ticker:n.ticker, name:n.name, revision:n.revision, createdAt:n.createdAt, updatedAt:n.updatedAt, reasons:[...n.reasons] as ThesisFields['reasons'], counter:n.counter, next:n.next, reviewDate:n.reviewDate, history }
  })
}
export function saveThesis(notes: Thesis[], input: {ticker:string;name:string;fields:ThesisFields;baseRevision:string|null;entry?:{judgment:Judgment;reason:string}}, revision:string, at:string): Thesis[] {
  const old = notes.find(n => n.ticker === input.ticker)
  if ((old?.revision ?? null) !== input.baseRevision) throw new Error('다른 탭에서 이 노트가 변경되었습니다. 작성 중인 내용을 복사한 뒤 페이지를 새로고침해 최신 노트를 확인하세요.')
  const history = [...(old?.history || [])]
  if (input.entry) history.push({ id:revision, at, ...input.entry })
  const next = { ...input.fields, ticker:input.ticker, name:input.name, revision, createdAt:old?.createdAt || at, updatedAt:at, history }
  return parseTheses(old ? notes.map(n => n.ticker === input.ticker ? next : n) : [...notes,next])
}
