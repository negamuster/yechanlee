import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import { useSavedItems } from './SavedItemsProvider'
import { isWebUrl } from '../lib/watchlist'
import { dataTime } from '../utils/dataTime'
type Event = { id: string; ticker: string; title: string; date: string; sourceUrl: string; session: string | null }
type Earnings = { events: Event[]; sources: { name: string; state: string; updatedAt: string | null; date: string | null }[] }
function validEarnings(value: unknown): value is Earnings {
  const data = value as Earnings | null
  return !!data && Array.isArray(data.events) && Array.isArray(data.sources)
}
export default function WatchlistEarnings() {
  const { items } = useSavedItems()
  const [revision, setRevision] = useState(0)
  const from = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const to = new Date(Date.parse(`${from}T12:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10)
  const { data, loading, error } = useResource(`/api/calendar?from=${from}&to=${to}&mode=earnings-week`, validEarnings, 5 * 60000, revision)
  const watched = new Set(items.stocks.map(s => s.ticker))
  const events = (data?.events || []).filter(e => watched.has(e.ticker) && isWebUrl(e.sourceUrl))
  const incomplete = error || data?.sources.some(s => s.state === 'unavailable' || s.state === 'stale')
  return <section aria-labelledby="watch-earnings"><h2 id="watch-earnings">다가오는 실적 발표</h2>
    <div className="watch-toolbar"><span>{from} ~ {to} · 미국 날짜</span><button type="button" disabled={loading} onClick={() => setRevision(n => n + 1)}>새로고침</button></div>
    <p className="saved-note">Nasdaq 예상 일정 · 변경 가능 · 발표일은 기업 IR에서 최종 확인하세요.</p>
    {loading && <p className="saved-note" role="status">관심 종목의 7일간 실적 일정을 조회하고 있습니다.</p>}
    {incomplete && <p className="watch-notice" role="status">일부 날짜의 최신 일정을 확인하지 못했습니다. 아래 목록은 이전 조회 결과를 포함할 수 있습니다.</p>}
    {!loading && !events.length && <div className="saved-empty">{incomplete ? '현재 확인 가능한 관심 종목 실적 일정이 없습니다.' : '조회된 7일간 일정에 관심 종목의 실적 발표가 없습니다.'}</div>}
    <ul className="watch-earnings-list">{events.map(e => <li key={e.id}><Link to={`/stock/${encodeURIComponent(e.ticker)}`}><strong>{e.ticker}</strong></Link><span>{e.date} · {e.session === 'pre' ? '미국 장전' : e.session === 'post' ? '미국 장후' : '시간 미정'}</span><a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">일정 출처 ↗</a></li>)}</ul>
    {!!data?.sources.length && <details className="watch-source"><summary>날짜별 확인 시각</summary>{data.sources.map(s => <p key={s.date}>{s.date} · {s.state === 'ok' ? '확인' : s.state === 'stale' ? '이전 데이터' : '조회 불가'} · {dataTime(s.updatedAt)}</p>)}</details>}
    <Link className="watch-calendar-link" to="/calendar">전체 경제·실적 캘린더 →</Link>
  </section>
}
