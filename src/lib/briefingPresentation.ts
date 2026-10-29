import type { Briefing } from './briefings'
export type BriefingSection = 'stocks' | 'assets' | 'events'
export function briefingSections(item?: Briefing) {
  return [
    { key: 'stocks' as const, label: '주요 종목', count: item?.homepage?.stocks.length ?? 0 },
    { key: 'assets' as const, label: '자산 흐름', count: item?.homepage?.assets.length ?? 0 },
    { key: 'events' as const, label: '오늘·다음 일정', count: item?.homepage?.events.length ?? 0 },
  ].filter(section => section.count > 0)
}
export const withoutCitations = (text: string) => text.replace(/\[(\d+)\]/g, '').trim()
export const trendClass = (change: string) => /[-−](?:US\$|\$)?\s*\d/.test(change) ? 'briefing-down' : /\+(?:US\$|\$)?\s*\d/.test(change) ? 'briefing-up' : ''
export const eventTime = (at: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at))
