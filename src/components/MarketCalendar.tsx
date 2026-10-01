import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './MarketCalendar.css'

type Category = 'All' | 'Economic' | 'Earnings' | 'Fed' | 'Events'
type CalendarEvent = { id: string; title: string; description?: string; category: Exclude<Category, 'All'>; date: string; startAt: string | null; session: 'pre' | 'post' | 'unknown' | null; major: boolean; source: string; sourceUrl: string; estimated: boolean }
type Source = { name: string; date: string | null; state: 'ok' | 'stale' | 'unavailable'; updatedAt: string | null; url: string }
type CalendarData = { events: CalendarEvent[]; sources: Source[]; fetchedAt: string }
const categories: Category[] = ['All', 'Economic', 'Earnings', 'Fed', 'Events']
const nyDate = (now: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
const monday = (date: string) => shift(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7))
const prettyDate = (date: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'UTC', month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(`${date}T12:00:00Z`))

export default function MarketCalendar({ full = false }: { full?: boolean }) {
  const [now, setNow] = useState(Date.now)
  const today = nyDate(now)
  const [view, setView] = useState<'today' | 'week'>('today')
  const [weekOffset, setWeekOffset] = useState(0)
  const [category, setCategory] = useState<Category>('All')
  const [timezone, setTimezone] = useState<'Asia/Seoul' | 'America/New_York'>('Asia/Seoul')
  const [data, setData] = useState<CalendarData | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const from = view === 'today' ? today : shift(monday(today), weekOffset * 7)
  const to = view === 'today' ? today : shift(from, 6)
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 30000)
    const refresh = window.setInterval(() => setReload(n => n + 1), 15 * 60000)
    return () => { clearInterval(clock); clearInterval(refresh) }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(false); setData(null)
    fetch(`/api/calendar?from=${from}&to=${to}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('unavailable')
        const result: CalendarData = await response.json()
        if (!Array.isArray(result.events) || !Array.isArray(result.sources)) throw new Error('invalid')
        setData(result)
      }).catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [from, to, reload])
  const events = (data?.events || []).filter(event => category === 'All' || event.category === category)
  const groups = [...new Set(events.map(event => event.date))]
  const issues = [...new Set((data?.sources || []).filter(source => source.state !== 'ok').map(source => `${source.name}${source.date ? ` ${source.date.slice(5)}` : ''}${source.state === 'stale' ? ' (이전 데이터)' : ''}`))]
  const stamp = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: timezone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
  const zoneLabel = timezone === 'Asia/Seoul' ? 'KST' : 'ET'
  return <section className={`market-calendar${full ? ' calendar-full' : ''}`} aria-label="경제·실적 캘린더">
    <div className="calendar-heading"><h2>Calendar</h2>{!full && <Link to="/calendar">View All ↗</Link>}</div>
    {full && <p className="calendar-intro">미국 경제지표, 기업 실적, 연준 발언과 주요 행사 일정을 확인하세요.</p>}
    <div className="calendar-controls">
      <div className="calendar-tabs" role="group" aria-label="조회 기간">
        <button type="button" aria-pressed={view === 'today'} onClick={() => { setView('today'); setWeekOffset(0) }}>Today</button>
        <button type="button" aria-pressed={view === 'week'} onClick={() => { setView('week'); setWeekOffset(0) }}>This Week</button>
      </div>
      <select aria-label="발표 시간대" value={timezone} onChange={e => setTimezone(e.target.value as typeof timezone)}><option value="Asia/Seoul">KST</option><option value="America/New_York">New York</option></select>
    </div>
    <div className="calendar-filters" role="group" aria-label="일정 종류">{categories.map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="calendar-range">
      {full && view === 'week' && <button type="button" disabled={weekOffset <= -4} aria-label="이전 주" onClick={() => setWeekOffset(n => n - 1)}>←</button>}
      <span>{prettyDate(from)}{from !== to && ` – ${prettyDate(to)}`} · 미국 날짜</span>
      {full && view === 'week' && <button type="button" disabled={weekOffset >= 12} aria-label="다음 주" onClick={() => setWeekOffset(n => n + 1)}>→</button>}
    </div>
    <p className="calendar-time-note">시간은 {zoneLabel} · 실적 날짜·장전·장후는 미국 기준</p>
    <div className="calendar-list" aria-busy={loading} tabIndex={0} aria-label="일정 목록">
      {loading && <p className="calendar-message" role="status">일정을 불러오는 중…</p>}
      {error && <p className="calendar-message" role="alert">일정을 불러오지 못했어요. <button type="button" onClick={() => setReload(n => n + 1)}>다시 시도</button></p>}
      {!loading && data && issues.length > 0 && <p className="calendar-warning" role="status">일부 일정 확인 불가: {issues.join(', ')}. 아래 목록이 불완전할 수 있어요. <button type="button" onClick={() => setReload(n => n + 1)}>재조회</button></p>}
      {!loading && !error && !events.length && <p className="calendar-message">{issues.length ? '현재 표시할 수 있는 일정이 없어요.' : '선택한 기간에 등록된 일정이 없어요.'}</p>}
      {groups.map(date => <div className="calendar-day" key={date}>
        <h3>{prettyDate(date)} <span>ET{date === today ? ' · Today' : ''}</span></h3>
        <ul>{events.filter(event => event.date === date).map(event => <li key={event.id} className={`calendar-event calendar-${event.category.toLowerCase()}`}>
          <div className="calendar-event-meta"><span className="calendar-category">{event.category}</span>{event.major && <span className="calendar-major" title="CPI·고용·GDP·PCE·FOMC 등 주요 일정">주요</span>}<span>{event.startAt ? `${stamp(event.startAt)} ${zoneLabel}` : event.session === 'pre' ? '장전 (ET)' : event.session === 'post' ? '장후 (ET)' : '시간 미정 (ET)'}</span></div>
          <a className="calendar-event-title" href={event.sourceUrl} target="_blank" rel="noopener noreferrer">{event.title} ↗</a>
          {full && event.description && <p className="calendar-event-description">{event.description}</p>}
          <div className="calendar-event-foot"><span>{event.source}</span><span>{event.estimated ? '예상 일정 · 변경 가능' : event.startAt && Date.parse(event.startAt) < now ? '예정 시각 지남' : '예정'}</span></div>
        </li>)}</ul>
      </div>)}
    </div>
    <p className="calendar-disclaimer">실적은 Nasdaq 예상 일정이며 기업 IR에서 최종 확인하세요. 주요 표시는 사이트 분류이며, 예정 시각 경과가 실제 발표를 뜻하지는 않습니다.</p>
    <div className="calendar-footer"><span>{data ? `조회 ${stamp(data.fetchedAt)} ${zoneLabel}` : 'BLS · BEA · Federal Reserve · Nasdaq'}</span>{data && <button type="button" disabled={loading} onClick={() => setReload(n => n + 1)}>새로고침</button>}</div>
  </section>
}
