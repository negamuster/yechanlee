export function monthGridDates(month: string): string[] {
  const first = new Date(`${month}-01T12:00:00Z`)
  const weekday = first.getUTCDay()
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const count = Math.max(35, Math.ceil((weekday + days) / 7) * 7)
  const start = first.getTime() - weekday * 86400000
  return Array.from({ length: count }, (_, index) => new Date(start + index * 86400000).toISOString().slice(0, 10))
}
