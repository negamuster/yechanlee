import latest from '../data/latest-briefing.json'
export type BriefingHomepage = {
  headline: string
  stocks: { name: string; ticker: string; change: string; reason: string; basis: string; sourceIds: number[] }[]
  assets: { label: string; value: string; change: string; basis: string; sourceIds: number[] }[]
  events: { at: string; label: string; detail?: string; sourceIds: number[] }[]
}
export type Briefing = {
  reviewMode?: 'manual' | 'automated' | 'rules' | 'gemini' | 'gemini-research'
  id: string; title: string; cutoffAt: string; publishedAt: string; sessionDate: string | null
  summary: string[]; blocks: { kind: string; text: string }[]
  sources: { id: number; label: string; url: string; accessNote?: string; links?: { label: string; url: string }[] }[]
  dataNote: string; corrections?: { at: string; text: string }[]
  homepage?: BriefingHomepage
}
// Only one edition belongs in the initial home graph. Archive consumers must stay lazy.
export const latestBriefing = (latest ?? undefined) as Briefing | undefined
export const kstTime = (s: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(s)) + ' KST'
