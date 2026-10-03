export function dataTime(value: string | number | null | undefined, timeZone = 'Asia/Seoul') {
  if (value == null) return '확인 불가'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '확인 불가'
  const formatted = new Intl.DateTimeFormat('ko-KR', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date)
  return `${formatted} ${timeZone === 'Asia/Seoul' ? 'KST' : 'ET'}`
}
