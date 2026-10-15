import type { Briefing } from './briefings'
export type BriefingSection = 'stocks' | 'assets' | 'events'
export interface MobileBriefingState { summary: boolean; section: BriefingSection | null }
export function validMobileBriefingState(value: unknown): value is MobileBriefingState {
  const state = value as MobileBriefingState | null
  return !!state && typeof state.summary === 'boolean' && (state.section === null || ['stocks', 'assets', 'events'].includes(state.section))
}
export function briefingSections(item?: Briefing) {
  return [
    { key: 'stocks' as const, label: '주요 종목', count: item?.homepage?.stocks.length ?? 0 },
    { key: 'assets' as const, label: '자산 흐름', count: item?.homepage?.assets.length ?? 0 },
    { key: 'events' as const, label: '오늘·다음 일정', count: item?.homepage?.events.length ?? 0 },
  ].filter(section => section.count > 0)
}
export function visibleBriefingSummary(summary: string[], expanded: boolean) {
  return expanded ? summary : summary.slice(0, 1)
}
export function briefingEventPreview(item: Briefing) {
  return [...(item.homepage?.events ?? [])].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0]
}
export const withoutCitations = (text: string) => text.replace(/\[(\d+)\]/g, '').trim()
export const trendClass = (change: string) => /[-−](?:US\$|\$)?\s*\d/.test(change) ? 'briefing-down' : /\+(?:US\$|\$)?\s*\d/.test(change) ? 'briefing-up' : ''
export const eventTime = (at: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at))
