import { useEffect, useState } from 'react'
const zones = [
  { label: '한국', zone: 'Asia/Seoul' },
  { label: '뉴욕', zone: 'America/New_York' },
].map(item => ({ ...item, formatter: new Intl.DateTimeFormat('en-GB', {
  timeZone: item.zone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
}) }))
export default function MarketClocks() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const update = () => setNow(new Date())
    const timer = window.setInterval(update, 1000)
    document.addEventListener('visibilitychange', update)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update) }
  }, [])
  return <div className="market-clocks" aria-label="한국 및 뉴욕 현지 날짜와 시간">
    {zones.map(({ label, zone, formatter }) => {
      const parts = formatter.formatToParts(now)
      const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || ''
      return <div className="market-clock" key={zone}>
        <span>{label} <small>{zone === 'Asia/Seoul' ? 'KST' : part('timeZoneName')}</small></span>
        <time dateTime={now.toISOString()}>{part('year')}.{part('month')}.{part('day')} <strong>{part('hour')}:{part('minute')}:{part('second')}</strong></time>
      </div>
    })}
  </div>
}
