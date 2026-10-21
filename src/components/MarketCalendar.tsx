import { refreshPolicies } from '../lib/refreshPolicy'
import { exportCalendar } from '../lib/calendarExport'
import { matchesCalendarFocus } from '../lib/calendarFilters'
import type { CalendarFocus } from '../lib/calendarFilters'
import { monthGridDates } from '../lib/calendarGrid'
import { useSavedItems } from './SavedItemsProvider'
import './Watchlist.css'
import { useResource } from '../hooks/useResource'
import { useSessionState } from '../hooks/useSessionState'
import { dataTime } from '../utils/dataTime'
import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import WidgetActions from './WidgetActions'
import ResourceState from './ResourceState'
import { calendarLabels as labels, koreanCalendarTitle as koreanTitle } from '../lib/calendarPresentation'
import type { CalendarCategory as Category, CalendarEvent, CalendarData } from '../lib/calendarPresentation'
import './MarketCalendar.css'

const categories: Category[] = ['All', 'Economic', 'Earnings', 'Fed', 'Events']
const nyDate = (now: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
const prettyDate = (date: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'UTC', month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date(`${date}T12:00:00Z`))
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
const weekStart = (date: string) => addDays(date, -new Date(`${date}T12:00:00Z`).getUTCDay())
const shiftMonth = (month: string, offset: number) => { const [year, m] = month.split('-').map(Number); return new Date(Date.UTC(year, m - 1 + offset, 1)).toISOString().slice(0, 7) }
function validCalendar(value: unknown): value is CalendarData {
  const data = value as CalendarData | null
  return !!data && Array.isArray(data.events) && Array.isArray(data.sources)
}
function useCalendarData(from: string, to: string, mode: 'month' | 'earnings' | 'earnings-week', reload: number) {
  return useResource(`/api/calendar?from=${from}&to=${to}&mode=${mode}`, validCalendar, refreshPolicies.calendar, reload)
}
export default function MarketCalendar({ full = false }: { full?: boolean }) {
  const { items } = useSavedItems()
  const watched = new Set(items.stocks.map(s => s.ticker))
  const [now, setNow] = useState(Date.now)
  const today = nyDate(now)
  const [month, setMonth] = useSessionState('calendar.month', () => today.slice(0, 7), v => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) && v >= shiftMonth(today.slice(0, 7), -1) && v <= shiftMonth(today.slice(0, 7), 3))
  const [selected, setSelected] = useSessionState('calendar.day', () => month === today.slice(0, 7) ? today : `${month}-01`, v => typeof v === 'string' && v.startsWith(`${month}-`) && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v)
  const [savedCategory, setCategory] = useSessionState<Category>('calendar.category', 'All', v => categories.includes(v as Category))
  const [savedFocus, setFocus] = useSessionState<CalendarFocus>('calendar.focus', 'all', v => ['all', 'major', 'watched'].includes(String(v)))
  const [language, setLanguage] = useSessionState<'ko' | 'en'>('calendar.language', 'ko', v => v === 'ko' || v === 'en')
  const [timezone, setTimezone] = useSessionState<'Asia/Seoul' | 'America/New_York'>('calendar.timezone', 'Asia/Seoul', v => v === 'Asia/Seoul' || v === 'America/New_York')
  const [savedView, setView] = useSessionState<'month' | 'week'>('calendar.view', 'month', v => v === 'month' || v === 'week')
  const category = full ? savedCategory : 'All'
  const focus = full ? savedFocus : 'all'
  const view = full ? savedView : 'month'
  const [exportMessage, setExportMessage] = useState('')
  const [infoOpen, setInfoOpen] = useState(false)
  const infoId = useId()
  const [reload, setReload] = useState(0)
  const from = `${month}-01`
  const [year, monthNumber] = month.split('-').map(Number)
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const to = `${month}-${days}`
  const weekFrom = weekStart(selected)
  const weekEnd = addDays(weekFrom, 6)
  const weekTo = weekEnd > addDays(today, 124) ? addDays(today, 124) : weekEnd
  const dates = view === 'week' ? Array.from({ length: 7 }, (_, index) => addDays(weekFrom, index)) : monthGridDates(month)
  const earliestDate = `${shiftMonth(today.slice(0, 7), -1)}-01`
  const latestMonth = shiftMonth(today.slice(0, 7), 3)
  const schedule = useCalendarData(view === 'week' ? weekFrom : from, view === 'week' ? weekTo : to, 'month', reload)
  const earnings = useCalendarData(view === 'week' ? weekFrom : selected, view === 'week' ? weekTo : selected, view === 'week' ? 'earnings-week' : 'earnings', reload)
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 30000)
    return () => { clearInterval(clock) }
  }, [])
  const events = [...(schedule.data?.events || []), ...(earnings.data?.events || [])].filter(event => (category === 'All' || event.category === category) && matchesCalendarFocus(event, focus, watched))
  const selectedEvents = events.filter(event => event.date === selected).sort((a, b) => {
    const order = (event: CalendarEvent) => event.startAt ? Date.parse(event.startAt) : Date.parse(`${event.date}T00:00:00Z`) + (event.session === 'pre' ? 0 : event.session === 'post' ? 30 : 48) * 3600000
    return Number(b.major) - Number(a.major) || order(a) - order(b) || a.title.localeCompare(b.title)
  })
  const issues = [...new Set([...(schedule.data?.sources || []), ...(earnings.data?.sources || [])].filter(source => source.state === 'stale' || source.state === 'unavailable').map(source => `${source.name}${source.state === 'stale' ? ' (이전 데이터)' : ''}`))]
  const stamp = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: timezone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
  const zoneLabel = timezone === 'Asia/Seoul' ? 'KST' : 'ET'
  const loading = schedule.loading || earnings.loading
  const hasData = !!schedule.data || !!earnings.data
  const failed = schedule.error || earnings.error
  const missingSources = [schedule.error ? '경제지표·연준 조회 실패' : '', earnings.error ? '실적 조회 실패' : '', ...issues].filter(Boolean)
  function navigate(offset: number) {
    if (view === 'week') { const date = addDays(selected, offset * 7); setSelected(date); setMonth(date.slice(0, 7)); return }
    const next = shiftMonth(month, offset); setMonth(next); setSelected(next === today.slice(0, 7) ? today : `${next}-01`) }
  function downloadEvent(event: CalendarEvent) {
    try {
      const file = exportCalendar([{ ...event, title: language === 'ko' ? koreanTitle(event) : event.title }])
      const url = URL.createObjectURL(new Blob([file], { type: 'text/calendar;charset=utf-8' }))
      const link = document.createElement('a'); link.href = url; link.download = `anthracite-${event.date}.ics`
      document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExportMessage('일정 파일 다운로드를 요청했습니다. 캘린더 앱에서 열어 추가하세요. 가져온 일정은 자동 갱신되지 않습니다.')
    } catch { setExportMessage('일정 파일을 만들지 못했습니다. 다시 시도해 주세요.') }
  }
  const agenda = <>
    <div className="calendar-selected-heading">{prettyDate(selected)} 일정 <span>{selected === today ? '오늘 · ' : ''}{loading && !hasData ? '확인 중' : `${selectedEvents.length}건`}{full && ` · ${focus === 'major' ? '주요 일정만' : focus === 'watched' ? '관심 종목 실적만' : '주요 일정 우선'}`}</span></div>
    <div className="calendar-list" aria-busy={loading} key={`${selected}:${category}:${focus}`} tabIndex={0} aria-label="선택한 날짜 일정">
      <ResourceState label="일정 데이터" loading={loading} error={failed} hasData={hasData} stale={issues.length > 0}
        failureMessage={hasData ? '일정 일부를 확인하지 못했습니다.' : '일정을 불러오지 못했습니다.'}
        failureDetail={missingSources.join(' · ')} onRetry={() => setReload(n => n + 1)} />
      {!loading && !selectedEvents.length && !failed && !issues.length && <p className="calendar-message" role="status">{focus === 'all' ? '선택한 날짜에 등록된 일정이 없어요.' : '선택한 날짜에 이 필터에 맞는 일정이 없어요.'}</p>}
      <div className="calendar-day"><ul>{selectedEvents.map(event => <li key={event.id} className={`calendar-event calendar-${event.category.toLowerCase()}${event.ticker && watched.has(event.ticker) ? ' is-watched' : ''}${event.major ? ' is-major' : ''}`}>
        <div className="calendar-event-meta">{event.ticker && watched.has(event.ticker) && <span className="calendar-watch-badge">★ 관심 종목</span>}<span className="calendar-category">{labels[event.category]}</span>{event.major && <span className="calendar-major">주요</span>}<span>{event.startAt ? `${stamp(event.startAt)} ${zoneLabel}` : event.session === 'pre' ? '장전 (미국)' : event.session === 'post' ? '장후 (미국)' : '시간 미정 (미국)'}</span></div>
        <a className="calendar-event-title" title={event.title} href={event.sourceUrl} target="_blank" rel="noopener noreferrer">{language === 'ko' ? koreanTitle(event) : event.title} ↗</a>
        {language === 'ko' && event.category !== 'Earnings' && <details className="calendar-original"><summary>원문 이름</summary><small className="calendar-original-title">{event.title}</small></details>}
        {full && event.description && <p className="calendar-event-description">{event.description}</p>}
        <div className="calendar-event-foot"><span>{event.source}</span><button type="button" className="calendar-export" aria-label={`${event.title} 일정 파일 저장`} onClick={() => downloadEvent(event)}>일정 저장 ↗</button><span>{event.estimated ? '예상 일정 · 변경 가능' : event.startAt && Date.parse(event.startAt) < now ? '예정 시각 지남' : '예정'}</span></div>
      </li>)}</ul></div>
    </div>
  </>
  const help = <>
    {schedule.data?.sources.filter(source => source.state === 'snapshot' || source.state === 'stale').map(source => <p className="calendar-time-note" key={source.name}>{source.name} 저장 일정 · {source.updatedAt ? `${stamp(source.updatedAt)} ${zoneLabel} 출처 확인` : '확인 시각 없음'} · 변경 가능</p>)}
    <p>{schedule.data ? `일정 조회 ${dataTime(schedule.data.fetchedAt, timezone)}` : 'BLS · BEA · 연준 · Nasdaq'}</p>
    <ul className="calendar-source-status">{[...(schedule.data?.sources || []), ...(earnings.data?.sources || [])].map(source => <li key={`${source.name}:${source.date || 'month'}`}><strong>{source.name}</strong>{source.date ? ` · ${source.date} 실적` : ''}<br />원본 확인: {dataTime(source.updatedAt, timezone)}<br />{source.state === 'unavailable' ? '조회 불가' : source.state === 'stale' ? '갱신 실패 또는 저장본 노후 · 이전 데이터' : source.state === 'snapshot' ? '저장 일정 사용 · 변경 가능' : '확인된 일정'} </li>)}</ul>
    <p>일정 조회는 서버 응답 생성 시각이며, 출처별 원본 확인 시각과 다를 수 있습니다. 저장 일정은 수집 이후 변경 사항이 아직 반영되지 않았을 수 있습니다.</p><p>날짜별 점과 요약은 현재 조회한 일정만 표시합니다. 월간 보기의 실적은 선택 날짜만, 주간 보기의 실적은 해당 주를 조회합니다. 빈 날짜가 일정 없음을 보장하지는 않습니다.</p><p>BLS 직접 조회가 어려우면 CPI·PPI·고용보고서 등 9개 지표군은 FRED 일정으로 보완합니다. 그 외 BLS 일정은 별도 저장본의 확인 시각을 따릅니다.</p><p>일정 저장은 개별 .ics 파일 다운로드입니다. 시각이 미정인 일정은 미국 기준 날짜의 종일 일정으로 저장하며, 이후 변경 사항은 자동 반영되지 않습니다.</p><p>실적일은 기업 IR에서 최종 확인하세요. 주요 표시는 사이트 분류이며, 예정 시각 경과가 발표 완료를 뜻하지는 않습니다.</p>
  </>
  return <section className={`market-calendar${full ? ' calendar-full' : ''}`} aria-label="경제·실적 캘린더">
    <div className={`calendar-heading${full ? '' : ' widget-heading'}`}><h2>{full ? <>Calendar <small>경제·실적</small></> : <Link to="/calendar" data-widget-link aria-label="Calendar 전체 경제·실적 캘린더 보기">Calendar</Link>}</h2>
      {!full && <WidgetActions label="Calendar" refresh={{ loading, onClick: () => setReload(n => n + 1) }} info={{ id: infoId, label: '캘린더 출처와 조회 범위', open: infoOpen, onClick: () => setInfoOpen(value => !value) }} />}
    </div>
    {!full && <div id={infoId} hidden={!infoOpen} className="calendar-help widget-info-panel" data-widget-interactive>{help}</div>}
    {full && <div className="calendar-controls">
      <div className="calendar-tabs" role="group" aria-label="캘린더 보기"><button type="button" aria-pressed={view === 'month'} onClick={() => setView('month')}>월간</button><button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>주간</button></div><div className="calendar-jump" role="group" aria-label="현재 날짜로 이동"><button type="button" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today) }}>오늘</button><button type="button" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); setView('week') }}>이번 주</button></div>
      <details className="calendar-settings-menu"><summary>설정 ⚙</summary><div className="calendar-settings">
        <select aria-label="일정 이름 언어" value={language} onChange={e => setLanguage(e.target.value as typeof language)}><option value="ko">한국어</option><option value="en">English</option></select>
        <select aria-label="발표 시간대" value={timezone} onChange={e => setTimezone(e.target.value as typeof timezone)}><option value="Asia/Seoul">한국시간</option><option value="America/New_York">뉴욕시간</option></select>
      </div></details>
    </div>}
    <div className="calendar-month-navigation"><button type="button" aria-label={view === 'week' ? '이전 주' : '이전 달'} disabled={view === 'week' ? addDays(selected, -7) < `${shiftMonth(today.slice(0, 7), -1)}-01` : month <= shiftMonth(today.slice(0, 7), -1)} onClick={() => navigate(-1)}>‹</button><strong aria-live="polite">{view === 'week' ? `${prettyDate(weekFrom)} – ${prettyDate(weekTo)}` : `${year}년 ${monthNumber}월`}</strong><button type="button" aria-label={view === 'week' ? '다음 주' : '다음 달'} disabled={view === 'week' ? addDays(selected, 7).slice(0, 7) > shiftMonth(today.slice(0, 7), 3) : month >= shiftMonth(today.slice(0, 7), 3)} onClick={() => navigate(1)}>›</button></div>
    {full && <><div className="calendar-filters" role="group" aria-label="일정 종류">{categories.map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => { setCategory(item); setFocus('all') }}>{item !== 'All' && <i aria-hidden="true" className={`calendar-key calendar-dot-${item.toLowerCase()}`} />}{labels[item]}</button>)}</div>
    <div className="calendar-focus-filters" role="group" aria-label="일정 빠른 필터">
      {([['all', '전체 일정'], ['major', '★ 주요 일정만'], ['watched', '관심 종목 실적만']] as const).map(([value, label]) => <button key={value} type="button" aria-label={label} aria-pressed={focus === value} onClick={() => { setFocus(value); setCategory(value === 'watched' ? 'Earnings' : 'All') }}>{label}</button>)}
    </div></>}
    {focus === 'watched' && <p className="calendar-time-note">{items.stocks.length ? (view === 'month' ? '관심 종목 실적은 선택한 날짜를 조회합니다. 주간 보기에서는 해당 주를 확인할 수 있습니다.' : '현재 표시된 주의 관심 종목 실적입니다.') : <>저장한 관심 종목이 없습니다. <Link to="/saved">관심 종목 추가 안내 ↗</Link></>}</p>}
    <div className={`calendar-month-grid${view === 'week' ? ' calendar-week-grid' : ''}`} aria-label={view === 'week' ? '주간 날짜 선택' : `${year}년 ${monthNumber}월 날짜 선택`}>
      {['일', '월', '화', '수', '목', '금', '토'].map(day => <span className="calendar-weekday" key={day}>{day}</span>)}
      {dates.map(date => {
        const outsideMonth = view === 'month' && date.slice(0, 7) !== month
        const dayEvents = events.filter(event => event.date === date).sort((a, b) => Number(b.major) - Number(a.major))
        const hasMajor = dayEvents.some(event => event.major)
        const types = [...new Set(dayEvents.map(event => event.category))]
        return <button type="button" key={date} data-date={date} disabled={date < earliestDate || date.slice(0, 7) > latestMonth || (view === 'week' && date > weekTo)} className={`calendar-date${outsideMonth ? ' is-outside-month' : ''}${date === today ? ' is-today' : ''}${hasMajor ? ' has-major' : ''}`} aria-pressed={date === selected} aria-current={date === today ? 'date' : undefined} aria-label={`${prettyDate(date)}${outsideMonth ? date < from ? ', 이전 달' : ', 다음 달' : ''}${hasMajor ? ", 주요 일정 있음" : ""}${types.length ? `, ${types.map(t => labels[t]).join('·')} 일정` : ''}`} onClick={() => { setSelected(date); setMonth(date.slice(0, 7)) }}><span className="calendar-date-number">{Number(date.slice(-2))}{hasMajor && <b className="calendar-important-mark" aria-hidden="true">★</b>}</span><span className="calendar-cell-preview" aria-hidden="true">{dayEvents.slice(0, 2).map((event, index) => <span key={event.id} title={language === 'ko' ? koreanTitle(event) : event.title} className={`calendar-cell-title calendar-${event.category.toLowerCase()}${index === 1 ? ' calendar-cell-secondary' : ''}`}>{language === 'ko' ? koreanTitle(event) : event.title}</span>)}{dayEvents.length > 1 && <span className="calendar-cell-more calendar-cell-more-compact">+{dayEvents.length - 1}</span>}{dayEvents.length > 2 && <span className="calendar-cell-more calendar-cell-more-wide">+{dayEvents.length - 2}</span>}</span><span className="calendar-dots" aria-hidden="true">{types.map(type => <i key={type} className={`calendar-dot-${type.toLowerCase()}`} />)}</span></button>
      })}
    </div>
    <div className="calendar-compact-status"><span>{full ? `미국 날짜 기준 · 시간 ${zoneLabel} · ★ 주요 일정` : `미국 날짜 · ${zoneLabel}`}</span>{full && <button type="button" disabled={loading} onClick={() => setReload(n => n + 1)}>새로고침</button>}</div>
    {full && schedule.data?.sources.some(source => source.name === 'FRED (BLS)' && ['snapshot', 'ok'].includes(source.state)) && <p className="calendar-time-note">BLS 보완 범위: CPI·PPI·고용보고서 등 9개 지표군은 FRED 확인 일정입니다. 나머지 BLS 일정은 별도 저장본의 확인 시각을 따르며, 저장본 만료 시 표시되지 않습니다.</p>}
    {agenda}
    {exportMessage && <p className="calendar-time-note" role="status">{exportMessage}<button type="button" onClick={() => setExportMessage('')}>닫기</button></p>}
    {full && <details className="calendar-help"><summary aria-label="캘린더 출처와 조회 범위" title="출처·조회 범위">정보 ⓘ · 출처·조회 범위</summary>{help}</details>}

  </section>
}
