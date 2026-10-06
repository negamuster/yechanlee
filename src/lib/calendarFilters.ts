export type CalendarFocus = 'all' | 'major' | 'watched'
export function matchesCalendarFocus(event: { category: string; major: boolean; ticker?: string }, focus: CalendarFocus, watched: Set<string>) {
  if (focus === 'major') return event.major
  if (focus === 'watched') return event.category === 'Earnings' && !!event.ticker && watched.has(event.ticker.toUpperCase())
  return true
}
