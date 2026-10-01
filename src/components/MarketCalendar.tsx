import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './MarketCalendar.css'

type Category = 'All' | 'Economic' | 'Earnings' | 'Fed' | 'Events'
type CalendarEvent = { id: string; title: string; description?: string; category: Exclude<Category, 'All'>; date: string; startAt: string | null; session: 'pre' | 'post' | 'unknown' | null; major: boolean; source: string; sourceUrl: string; estimated: boolean }
type Source = { name: string; date: string | null; state: 'ok' | 'stale' | 'unavailable'; updatedAt: string | null; url: string }
type CalendarData = { events: CalendarEvent[]; sources: Source[]; fetchedAt: string }
const categories: Category[] = ['All', 'Economic', 'Earnings', 'Fed', 'Events']
const labels: Record<Category, string> = { All: '전체', Economic: '경제지표', Earnings: '실적', Fed: '연준', Events: '행사' }
const nyDate = (now: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
const prettyDate = (date: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'UTC', month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(`${date}T12:00:00Z`))
const shiftMonth = (month: string, offset: number) => { const [year, m] = month.split('-').map(Number); return new Date(Date.UTC(year, m - 1 + offset, 1)).toISOString().slice(0, 7) }
const translations: [RegExp, string][] = [
  [/Consumer Price Index/i, '소비자물가지수 (CPI)'], [/Producer Price Index/i, '생산자물가지수 (PPI)'],
  [/^Employment Situation/i, '고용보고서'], [/Job Openings and Labor Turnover Survey/i, '구인·이직 보고서 (JOLTS)'],
  [/Personal Income and Outlays/i, '개인소득·소비지출 (PCE)'], [/Gross Domestic Product|^GDP\b/i, '국내총생산 (GDP)'],
  [/Employment Cost Index/i, '고용비용지수'], [/Productivity and Costs/i, '생산성·노동비용'],
  [/U.S. International Trade in Goods and Services/i, '미국 무역수지'], [/Import and Export Price/i, '수출입 물가지수'],
  [/Metropolitan Area Employment/i, '대도시권 고용·실업'], [/State Employment and Unemployment/i, '주별 고용·실업'],
  [/Real Earnings/i, '실질임금'], [/FOMC Press Conference/i, 'FOMC 기자회견'], [/FOMC Minutes/i, 'FOMC 의사록'],
  [/FOMC Meeting/i, 'FOMC 회의'], [/Beige Book/i, '베이지북'],
]
function koreanTitle(event: CalendarEvent) {
  if (event.category === 'Earnings') return `${event.title} · 실적 발표`
  const match = translations.find(([pattern]) => pattern.test(event.title))
  if (match) return match[1]
  if (/^Speech/i.test(event.title)) return `연준 연설 · ${event.title.replace(/^Speech\s*-\s*/i, '')}`
  if (/^Discussion/i.test(event.title)) return `연준 대담 · ${event.title.replace(/^Discussion\s*-\s*/i, '')}`
  if (/Holiday/i.test(event.title)) return `연준 휴일 안내 · ${event.title.replace(/^Holiday\s*-\s*/i, '')}`
  return `${labels[event.category]} · ${event.title}`
}
function useCalendarData(from: string, to: string, mode: 'month' | 'earnings', reload: number) {
  const [state, setState] = useState<{ data: CalendarData | null; loading: boolean; error: boolean }>({ data: null, loading: true, error: false })
  useEffect(() => {
    const controller = new AbortController()
    setState({ data: null, loading: true, error: false })
    fetch(`/api/calendar?from=${from}&to=${to}&mode=${mode}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('unavailable')
        const data: CalendarData = await response.json()
        if (!Array.isArray(data.events) || !Array.isArray(data.sources)) throw new Error('invalid')
        if (!controller.signal.aborted) setState({ data, loading: false, error: false })
      }).catch(() => { if (!controller.signal.aborted) setState({ data: null, loading: false, error: true }) })
    return () => controller.abort()
  }, [from, to, mode, reload])
  return state
}
export default function MarketCalendar({ full = false }: { full?: boolean }) {
  const [now, setNow] = useState(Date.now)
  const today = nyDate(now)
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [selected, setSelected] = useState(() => today)
  const [category, setCategory] = useState<Category>('All')
  const [language, setLanguage] = useState<'ko' | 'en'>('ko')
  const [timezone, setTimezone] = useState<'Asia/Seoul' | 'America/New_York'>('Asia/Seoul')
  const [reload, setReload] = useState(0)
  const from = `${month}-01`
  const [year, monthNumber] = month.split('-').map(Number)
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const to = `${month}-${days}`
  const firstWeekday = new Date(`${from}T12:00:00Z`).getUTCDay()
  const schedule = useCalendarData(from, to, 'month', reload)
  const earnings = useCalendarData(selected, selected, 'earnings', reload)
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 30000)
    const refresh = window.setInterval(() => setReload(n => n + 1), 15 * 60000)
    return () => { clearInterval(clock); clearInterval(refresh) }
  }, [])
  const events = [...(schedule.data?.events || []), ...(earnings.data?.events || [])].filter(event => category === 'All' || event.category === category)
  const selectedEvents = events.filter(event => event.date === selected)
  const issues = [...new Set([...(schedule.data?.sources || []), ...(earnings.data?.sources || [])].filter(source => source.state !== 'ok').map(source => `${source.name}${source.state === 'stale' ? ' (이전 데이터)' : ''}`))]
  const stamp = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: timezone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
  const zoneLabel = timezone === 'Asia/Seoul' ? 'KST' : 'ET'
  const loading = schedule.loading || earnings.loading
  function navigate(offset: number) { const next = shiftMonth(month, offset); setMonth(next); setSelected(next === today.slice(0, 7) ? today : `${next}-01`) }
  return <section className={`market-calendar${full ? ' calendar-full' : ''}`} aria-label="경제·실적 캘린더">
    <div className="calendar-heading"><h2>Calendar <small>경제·실적</small></h2>{!full && <Link to="/calendar">크게 보기 ↗</Link>}</div>
    <div className="calendar-controls">
      <button type="button" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today) }}>오늘</button>
      <div className="calendar-settings">
        <select aria-label="일정 이름 언어" value={language} onChange={e => setLanguage(e.target.value as typeof language)}><option value="ko">한국어</option><option value="en">English</option></select>
        <select aria-label="발표 시간대" value={timezone} onChange={e => setTimezone(e.target.value as typeof timezone)}><option value="Asia/Seoul">한국시간</option><option value="America/New_York">뉴욕시간</option></select>
      </div>
    </div>
    <div className="calendar-month-navigation"><button type="button" aria-label="이전 달" disabled={month <= shiftMonth(today.slice(0, 7), -1)} onClick={() => navigate(-1)}>‹</button><strong aria-live="polite">{year}년 {monthNumber}월</strong><button type="button" aria-label="다음 달" disabled={month >= shiftMonth(today.slice(0, 7), 3)} onClick={() => navigate(1)}>›</button></div>
    <div className="calendar-filters" role="group" aria-label="일정 종류">{categories.map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{labels[item]}</button>)}</div>
    <div className="calendar-month-grid" aria-label={`${year}년 ${monthNumber}월 날짜 선택`}>
      {['일', '월', '화', '수', '목', '금', '토'].map(day => <span className="calendar-weekday" key={day}>{day}</span>)}
      {Array.from({ length: firstWeekday }, (_, i) => <span key={`empty-${i}`} aria-hidden="true" />)}
      {Array.from({ length: days }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`
        const types = [...new Set(events.filter(event => event.date === date).map(event => event.category))]
        return <button type="button" key={date} className={`calendar-date${date === today ? ' is-today' : ''}`} aria-pressed={date === selected} aria-current={date === today ? 'date' : undefined} aria-label={`${prettyDate(date)}${types.length ? `, ${types.map(t => labels[t]).join('·')} 일정` : ''}`} onClick={() => setSelected(date)}><span>{i + 1}</span><span className="calendar-dots" aria-hidden="true">{types.map(type => <i key={type} className={`calendar-dot-${type.toLowerCase()}`} />)}</span></button>
      })}
    </div>
    <p className="calendar-time-note">달력 날짜: 미국 기준 · 발표 시간: {zoneLabel}<br />날짜별 점은 경제지표·연준·행사 일정입니다. 실적은 날짜를 눌러 조회하세요.</p>
    <div className="calendar-selected-heading">{prettyDate(selected)} 일정 <span>{selected === today ? '오늘' : ''}</span></div>
    <div className="calendar-list" aria-busy={loading} tabIndex={0} aria-label="선택한 날짜 일정">
      {loading && <p className="calendar-message" role="status">일정을 불러오는 중…</p>}
      {(schedule.error || earnings.error || issues.length > 0) && <p className="calendar-warning" role="status">{schedule.error ? '경제지표·연준 일정 조회 실패. ' : ''}{earnings.error ? '실적 일정 조회 실패. ' : ''}{issues.length > 0 ? `${issues.join(', ')} 일정 일부 확인 불가. ` : ''}<button type="button" onClick={() => setReload(n => n + 1)}>재조회</button></p>}
      {!loading && !selectedEvents.length && <p className="calendar-message">{schedule.error || earnings.error || issues.length ? '현재 확인 가능한 일정이 없어요.' : '선택한 날짜에 등록된 일정이 없어요.'}</p>}
      <div className="calendar-day"><ul>{selectedEvents.map(event => <li key={event.id} className={`calendar-event calendar-${event.category.toLowerCase()}`}>
        <div className="calendar-event-meta"><span className="calendar-category">{labels[event.category]}</span>{event.major && <span className="calendar-major">주요</span>}<span>{event.startAt ? `${stamp(event.startAt)} ${zoneLabel}` : event.session === 'pre' ? '장전 (미국)' : event.session === 'post' ? '장후 (미국)' : '시간 미정 (미국)'}</span></div>
        <a className="calendar-event-title" title={event.title} href={event.sourceUrl} target="_blank" rel="noopener noreferrer">{language === 'ko' ? koreanTitle(event) : event.title} ↗</a>
        {language === 'ko' && event.category !== 'Earnings' && <small className="calendar-original-title">{event.title}</small>}
        {full && event.description && <p className="calendar-event-description">{event.description}</p>}
        <div className="calendar-event-foot"><span>{event.source}</span><span>{event.estimated ? '예상 일정 · 변경 가능' : event.startAt && Date.parse(event.startAt) < now ? '예정 시각 지남' : '예정'}</span></div>
      </li>)}</ul></div>
    </div>
    <p className="calendar-disclaimer">실적일은 기업 IR에서 최종 확인하세요. 주요 표시는 사이트 분류이며, 예정 시각 경과가 발표 완료를 뜻하지는 않습니다.</p>
    <div className="calendar-footer"><span>{schedule.data ? `조회 ${stamp(schedule.data.fetchedAt)} ${zoneLabel}` : 'BLS · BEA · 연준 · Nasdaq'}</span><button type="button" disabled={loading} onClick={() => setReload(n => n + 1)}>새로고침</button></div>
  </section>
}
