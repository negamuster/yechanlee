type ExportEvent = { id: string; title: string; date: string; startAt: string | null; source: string; sourceUrl: string; estimated: boolean; session: 'pre' | 'post' | 'unknown' | null; description?: string }
const escapeText = (text: string) => text.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
const utc = (value: string | Date) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
function fold(line: string) {
  const lines: string[] = []; let part = '', size = 0
  for (const char of line) { const bytes = new TextEncoder().encode(char).length; if (size + bytes > 75) { lines.push(part); part = ' '; size = 1 } part += char; size += bytes }
  lines.push(part); return lines.join('\r\n')
}
export function exportCalendar(events: ExportEvent[], now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Anthracite//Market Calendar//KO', 'CALSCALE:GREGORIAN']
  for (const event of events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !Number.isFinite(Date.parse(event.date)) || new Date(event.date).toISOString().slice(0, 10) !== event.date) throw new Error('Invalid event date')
    const timed = !!event.startAt && Number.isFinite(Date.parse(event.startAt))
    const description = [event.description, `출처: ${event.source}`, event.sourceUrl, event.estimated ? '예상 일정 · 변경 가능' : '', !timed ? `미국 기준 날짜 · ${event.session === 'pre' ? '장전' : event.session === 'post' ? '장후' : '시간 미정'} (정확한 시각이 없어 종일 일정으로 저장)` : '', '가져온 일정은 자동 갱신되지 않습니다. 원본에서 변경 여부를 확인하세요.'].filter(Boolean).join('\n')
    lines.push('BEGIN:VEVENT', `UID:${encodeURIComponent(event.id)}@anthracite`, `DTSTAMP:${utc(now)}`, timed ? `DTSTART:${utc(event.startAt!)}` : `DTSTART;VALUE=DATE:${event.date.replace(/-/g,'')}`, `SUMMARY:${escapeText(event.title + (event.estimated ? ' (예상)' : ''))}`, `DESCRIPTION:${escapeText(description)}`, 'TRANSP:TRANSPARENT', 'END:VEVENT')
  }
  return lines.concat('END:VCALENDAR').map(fold).join('\r\n') + '\r\n'
}
