import items from '../data/published-briefings.json'
export type Briefing = {
  id: string; title: string; cutoffAt: string; publishedAt: string; sessionDate: string
  summary: string[]; blocks: { kind: string; text: string }[]
  sources: { id: number; label: string; url: string }[]
  dataNote: string; corrections: { at: string; text: string }[]
}
export const briefings = items as Briefing[]
export const latestBriefing = briefings[0]
export const kstTime = (s: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(s)) + ' KST'
