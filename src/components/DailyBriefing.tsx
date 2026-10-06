import { Link } from 'react-router-dom'
import { latestBriefing, kstTime } from '../lib/briefings'
import './DailyBriefing.css'
export default function DailyBriefing({ inlineCalendar = false }: { inlineCalendar?: boolean }) {
  const item = latestBriefing
  return <section className="daily-briefing" aria-labelledby="daily-briefing-title">
    <div className="briefing-kicker"><h2 id="daily-briefing-title">Daily Market Briefing</h2><Link to="/briefings">지난 브리핑 ↗</Link></div>
    {item ? <>
      <p className="briefing-meta">미국 거래일 {item.sessionDate} · 기준 {kstTime(item.cutoffAt)}</p>
      <h3><Link to={`/briefings/${item.id}`}>{item.title}</Link></h3>
      {item.summary.map((text,i)=><p key={i}>{text}</p>)}
      <Link className="briefing-read" to={`/briefings/${item.id}`}>전체 브리핑 읽기 →</Link>
      <p className="briefing-meta">가장 최근 게시된 브리핑 · 실시간 시황이 아닙니다.</p>
    </> : <div className="briefing-empty">
      <span className="briefing-edition">ANTHRACITE / DAILY</span>
      <h3>시장의 흐름과<br />다음 확인할 변화를 한곳에.</h3>
      <p>첫 브리핑을 준비하고 있습니다. 출처와 수치를 검토한 뒤 게시합니다.</p>
      <ul><li>미국장 마감과 이후의 주요 소식</li><li>경제·기업 뉴스의 의미와 변화</li><li>다음 경제지표와 실적 일정</li></ul>
      {inlineCalendar ? <a className="briefing-read" href="#home-calendar" onClick={event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        const target = document.getElementById('home-calendar')
        if (!target) return
        event.preventDefault()
        target.focus({ preventScroll: true })
        target.scrollIntoView({ behavior: 'instant', block: 'start' })
      }}>캘린더 보기 →</a> : <Link className="briefing-read" to="/calendar">캘린더 보기 →</Link>}
    </div>}
  </section>
}
