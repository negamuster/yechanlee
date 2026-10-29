import { Link } from 'react-router-dom'
import { latestBriefing, kstTime } from '../lib/briefings'
import type { Briefing } from '../lib/briefings'
import { withoutCitations } from '../lib/briefingPresentation'
import { CitedText } from './BriefingReferences'
import './HomeBriefing.css'

export function HomeBriefingCard({ item, mobile = false }: { item?: Briefing; mobile?: boolean }) {
  const mode = item?.reviewMode === 'automated' ? 'AI 작성·자동 검토' : item?.reviewMode === 'gemini-research' ? 'Gemini 본문 요약·해석 · 자동 근거 대조' : item?.reviewMode === 'gemini' ? 'Gemini 제목 요약 · 자동 대조' : item?.reviewMode === 'rules' ? '규칙 기반 자동 정리 · AI 미사용' : ''
  return <section className="home-briefing-card" aria-labelledby="home-briefing-title">
    <div className="briefing-kicker widget-heading"><h2 id="home-briefing-title"><Link to="/briefings" data-widget-link aria-label={`${mobile ? '오늘의 브리핑' : 'Daily Market Briefing'} · 지난 브리핑 목록 보기`}>{mobile ? '오늘의 브리핑' : 'Daily Market Briefing'}</Link></h2></div>
    {item ? <>
      <p className="briefing-meta home-briefing-date">{item.sessionDate ? `미국 거래일 ${item.sessionDate}` : '뉴스·공식 지표 모음'} · 기준 <time dateTime={item.cutoffAt}>{kstTime(item.cutoffAt)}</time></p>
      <h3><Link to={`/briefings/${item.id}`}>{withoutCitations(item.homepage?.headline ?? item.title)}</Link></h3>
      <div className="home-briefing-summaries">{item.summary.slice(0, 3).map((text, index) => <p className="home-briefing-summary" key={index}><CitedText item={item} text={text} /></p>)}</div>
      <div className="home-briefing-footer">
        <Link className="home-briefing-read" to={`/briefings/${item.id}`}>브리핑 전체 보기 <span aria-hidden="true">→</span></Link>
        <p className="briefing-meta home-briefing-disclaimer">{mode && <>{mode} · </>}최근 게시본 · 실시간 시황이 아닙니다.</p>
      </div>
    </> : <div className="home-briefing-empty"><h3>브리핑을 준비하고 있습니다.</h3><p>출처와 수치를 검토한 뒤 게시합니다.</p><Link to="/#home-news-title">최신 뉴스 먼저 보기 ↓</Link></div>}
  </section>
}

export default function HomeBriefing({ mobile = false }: { mobile?: boolean }) {
  return <HomeBriefingCard item={latestBriefing} mobile={mobile} />
}
