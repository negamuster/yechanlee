export type CalendarCategory = 'All' | 'Economic' | 'Earnings' | 'Fed' | 'Events'
export interface CalendarEvent {
  ticker?: string; id: string; title: string; description?: string; category: Exclude<CalendarCategory, 'All'>
  date: string; startAt: string | null; session: 'pre' | 'post' | 'unknown' | null
  major: boolean; source: string; sourceUrl: string; estimated: boolean
}
export interface CalendarSource {
  name: string; date: string | null; state: 'ok' | 'snapshot' | 'stale' | 'unavailable'; updatedAt: string | null; url: string
  error?: string; checkedAt?: string; nextRetryAt?: string
}
export function calendarFailureLabel(code: string) {
  return code === 'http_403' ? '출처 서버 접근 거부 (403)' : /^http_(404|410)$/.test(code) ? '출처 주소 확인 필요'
    : code === 'http_429' ? '출처 요청 한도 초과 (429)' : code === 'timeout' ? '출처 응답 시간 초과'
      : code === 'snapshot_out_of_range' ? '보완 일정의 조회 범위 밖' : '출처 갱신 실패'
}
export interface CalendarData { events: CalendarEvent[]; sources: CalendarSource[]; fetchedAt: string }
export const calendarLabels: Record<CalendarCategory, string> = { All: '전체', Economic: '경제지표', Earnings: '실적', Fed: '연준', Events: '행사' }
const translations: [RegExp, string][] = [
  [/Consumer Price Index/i, '소비자물가지수 (CPI)'], [/Producer Price Index/i, '생산자물가지수 (PPI)'],
  [/^Employment Situation/i, '고용보고서'], [/Job Openings and Labor Turnover Survey/i, '구인·이직 보고서 (JOLTS)'],
  [/Personal Income and Outlays/i, '개인소득·소비지출 (PCE)'], [/Gross Domestic Product|^GDP\b/i, '국내총생산 (GDP)'],
  [/Employment Cost Index/i, '고용비용지수'], [/Productivity and Costs/i, '생산성·노동비용'],
  [/U.S. International Trade in Goods and Services/i, '미국 무역수지'], [/Import and Export Price/i, '수출입 물가지수'],
  [/Metropolitan Area Employment/i, '대도시권 고용·실업'], [/State Employment and Unemployment/i, '주별 고용·실업'],
  [/Real Earnings/i, '실질임금'], [/FOMC Press Conference/i, 'FOMC 기자회견'], [/FOMC Minutes/i, 'FOMC 의사록'],
  [/FOMC Meeting/i, 'FOMC 회의 · 금리 결정 일정'], [/Beige Book/i, '베이지북'],
]
export function koreanCalendarTitle(event: CalendarEvent) {
  if (event.category === 'Earnings') return `${event.title} · 실적 발표`
  const match = translations.find(([pattern]) => pattern.test(event.title))
  if (match) return match[1]
  if (/^Speech/i.test(event.title)) return `연준 연설 · ${event.title.replace(/^Speech\s*-\s*/i, '')}`
  if (/^Discussion/i.test(event.title)) return `연준 대담 · ${event.title.replace(/^Discussion\s*-\s*/i, '')}`
  if (/Holiday/i.test(event.title)) return `연준 휴일 안내 · ${event.title.replace(/^Holiday\s*-\s*/i, '')}`
  return `${calendarLabels[event.category]} · ${event.title}`
}
