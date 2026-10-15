import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { useSessionState } from '../hooks/useSessionState'
import { useSavedItems } from './SavedItemsProvider'
import { calendarLabels, koreanCalendarTitle } from '../lib/calendarPresentation'
import type { CalendarData } from '../lib/calendarPresentation'
import { calendarPreviewHealth, calendarPreviewRange, calendarPreviewRequest, calendarPreviewTime, selectUpcomingCalendar, validCalendarPreview } from '../lib/calendarPreview'
import type { CalendarTimezone } from '../lib/calendarPreview'
import { dataTime } from '../utils/dataTime'
import './CalendarPreview.css'

interface CalendarResource { data: CalendarData | null; loading: boolean; error: boolean }
export function CalendarPreviewCard({ now, resource, watched, language = 'ko', timezone = 'Asia/Seoul', onRefresh }: {
  now: number; resource: CalendarResource; watched: Set<string>; language?: 'ko' | 'en'; timezone?: CalendarTimezone; onRefresh: () => void
}) {
  const [infoOpen, setInfoOpen] = useState(false)
  const id = useId()
  const { data, loading, error } = resource
  const watchedTickers = new Set([...watched].map(ticker => ticker.toUpperCase()))
  const { from, to } = calendarPreviewRange(now)
  const { events, total } = selectUpcomingCalendar(data?.events || [], now, watched)
  const health = calendarPreviewHealth(data, error)
  const incomplete = error || data?.sources.some(source => ['stale', 'unavailable'].includes(source.state))
  const zone = timezone === 'Asia/Seoul' ? 'KST' : 'ET'
  const collected = data ? new Intl.DateTimeFormat('ko-KR', { timeZone: timezone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(data.fetchedAt)) : null
  return <section className="calendar-preview" aria-labelledby={`${id}-title`}>
    <div className="calendar-heading"><h2 id={`${id}-title`}><Link to="/calendar" data-widget-link aria-label="Calendar 전체 경제·실적 캘린더 보기">Calendar</Link></h2><span className="calendar-preview-zone">{zone}</span></div>
    <p className="calendar-preview-heading">주요 일정 · 다음 7일</p>
    {health && <p className={`calendar-preview-status${incomplete ? ' is-warning' : ''}`} role="status">{health}</p>}
    <div aria-busy={loading}>
      {loading && !data ? <div className="calendar-preview-skeleton" aria-label="일정을 불러오는 중" role="status"><span /><span /><span /></div>
        : events.length ? <ol className="calendar-preview-events" aria-label="다가오는 주요 일정">
          {events.map(event => {
            const time = calendarPreviewTime(event, timezone)
            const title = language === 'ko' ? koreanCalendarTitle(event) : event.title
            const saved = event.category === 'Earnings' && Boolean(event.ticker && watchedTickers.has(event.ticker.toUpperCase()))
            const source = data?.sources.find(source => source.name === event.source && (!source.date || source.date === event.date))
            return <li key={event.id} data-reading-key={`calendar-preview:${event.id}`}>
              <a className="calendar-preview-event" href={event.sourceUrl} target="_blank" rel="noopener noreferrer"
                data-focus-key={`calendar-preview:${event.id}`} aria-label={`${title} · ${time.description} · ${event.source} 원문, 새 탭`}>
                <time dateTime={event.startAt || event.date} title={time.description}><span>{time.date}</span><strong>{time.time}</strong></time>
                <div className="calendar-preview-event-content"><h3>{title}</h3>
                  <p className="calendar-preview-meta"><span>{saved ? '★ 관심 종목' : calendarLabels[event.category]}</span><span>{event.source}</span>
                    {event.estimated && <span>예상 · 변경 가능</span>}
                    {source?.state === 'stale' && <span className="calendar-preview-source-warning">이전 자료</span>}
                    {source?.state === 'snapshot' && <span>저장 일정</span>}
                  </p>
                </div>
              </a>
            </li>
          })}
        </ol> : <p className="calendar-preview-empty" role="status">{error && !data ? '새로고침으로 다시 확인해 주세요.' : incomplete ? '현재 확인 가능한 주요 일정이 없습니다.' : '향후 7일 내 확인된 주요 일정이 없습니다.'}</p>}
    </div>
    <div className="calendar-preview-footer">
      <span>{collected ? <><time dateTime={data!.fetchedAt} title={`일정 조회 ${dataTime(data!.fetchedAt, timezone)}`}>{collected}</time> 조회</> : loading ? '일정 확인 중' : '조회 기록 없음'}</span>
      <div><button type="button" disabled={loading} aria-label="일정 새로고침" title="일정 새로고침" onClick={onRefresh}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9" /></svg>
      </button><button type="button" aria-label="일정 출처와 표시 기준" title="출처·표시 기준" aria-expanded={infoOpen} aria-controls={`${id}-info`} onClick={() => setInfoOpen(value => !value)}>ⓘ</button></div>
    </div>
    <div id={`${id}-info`} className="calendar-preview-info" hidden={!infoOpen} data-widget-interactive>
      <p>미국 날짜 {from}–{to}의 주요 경제·연준 일정과 관심 종목 실적 중 가까운 {events.length}건을 표시합니다{total > events.length ? ` (확인된 ${total}건 중 최대 5건)` : ''}.</p>
      <p>시각이 지난 일정은 제외합니다. 발표 시각이 미정인 실적은 미국 날짜와 장전·장후 기준이며, 진행 여부를 뜻하지 않습니다. 예상 일정은 변경될 수 있습니다.</p>
      <p>주요 표시는 사이트 분류이며, 등록되지 않은 일정이 있을 수 있습니다.</p>
      {data && <p>일정 조회 {dataTime(data.fetchedAt, timezone)} · 조회 시각과 출처별 원본 확인 시각은 다를 수 있습니다.</p>}
      <ul>{data?.sources.map(source => <li key={`${source.name}:${source.date || 'schedule'}`}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}{source.date ? ` · ${source.date}` : ''}</a>
        <span>{source.state === 'ok' ? '확인된 일정' : source.state === 'snapshot' ? '저장 일정 · 변경 가능' : source.state === 'stale' ? '갱신 실패 또는 저장본 노후 · 이전 자료' : '조회 불가'}</span>
        <span>원본 확인 {dataTime(source.updatedAt, timezone)}</span></li>)}</ul>
    </div>
  </section>
}

export default function CalendarPreview() {
  const { items } = useSavedItems()
  const [now, setNow] = useState(Date.now)
  const [revision, setRevision] = useState(0)
  const [language] = useSessionState<'ko' | 'en'>('calendar.language', 'ko', value => value === 'ko' || value === 'en')
  const [timezone] = useSessionState<CalendarTimezone>('calendar.timezone', 'Asia/Seoul', value => value === 'Asia/Seoul' || value === 'America/New_York')
  const watched = new Set(items.stocks.map(stock => stock.ticker))
  const resource = useResource(calendarPreviewRequest(now, watched.size > 0), validCalendarPreview, 5 * 60000, revision)
  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 30000)
    const refresh = window.setInterval(() => setRevision(value => value + 1), 15 * 60000)
    return () => { window.clearInterval(clock); window.clearInterval(refresh) }
  }, [])
  return <CalendarPreviewCard now={now} resource={resource} watched={watched} language={language} timezone={timezone} onRefresh={() => setRevision(value => value + 1)} />
}
