import { Link } from 'react-router-dom'
import { latestBriefing, kstTime } from '../lib/briefings'
import './DailyBriefing.css'
export default function DailyBriefing() {
  const item = latestBriefing
  const withoutCitations = (text: string) => text.replace(/\[(\d+)\]/g, '').trim()
  const rate = item?.blocks.find(b => b.kind === 'paragraph' && /2년물.*10년물.*30년물/.test(b.text))
  const news = item?.blocks.filter(b => b.kind === 'subheading').flatMap(b => {
    const id = Number(b.text.match(/\[(\d+)\]$/)?.[1])
    const source = item.sources.find(s => s.id === id)
    return source ? [{ text: withoutCitations(b.text), source, publisher: source.label.split(' · ')[0] }] : []
  }) ?? []
  const seenPublishers = new Set<string>()
  const headlines = news.filter(n => { if (seenPublishers.has(n.publisher)) return false; seenPublishers.add(n.publisher); return true }).slice(0, 3)
  const calendarStart = item?.blocks.findIndex(b => b.kind === 'heading' && b.text.includes('공식 일정')) ?? -1
  const calendar = calendarStart >= 0 ? item?.blocks.slice(calendarStart + 1).find(b => b.kind === 'paragraph') : undefined
  return <section className="daily-briefing" aria-labelledby="daily-briefing-title">
    <div className="briefing-kicker"><h2 id="daily-briefing-title">Daily Market Briefing</h2><Link to="/briefings">지난 브리핑 ↗</Link></div>
    {item ? <>
      <p className="briefing-meta">{item.sessionDate ? `미국 거래일 ${item.sessionDate}` : '뉴스·공식 지표 모음'} · 기준 {kstTime(item.cutoffAt)}</p>
      <h3><Link to={`/briefings/${item.id}`}>{item.title}</Link></h3>
      {item.reviewMode === 'rules' ? <div className="briefing-at-a-glance">
        <div className="briefing-highlight">
          <h4>금리 변화</h4>
          <p>{rate ? withoutCitations(rate.text) : '이번 발행에서 확인된 금리 자료가 없습니다.'}</p>
          {rate && <Link to={`/briefings/${item.id}#source-${rate.text.match(/\[(\d+)\]/)?.[1] ?? '1'}`}>관측일·출처 확인 ↗</Link>}
        </div>
        <div className="briefing-highlight">
          <h4>오늘 읽을 뉴스 <span>원문 제목 · 매체별 1건</span></h4>
          <ul>{headlines.map(n => <li key={n.source.id}><a href={n.source.url} target="_blank" rel="noopener noreferrer">{n.text} ↗</a><span>{n.publisher}</span></li>)}</ul>
        </div>
        <div className="briefing-highlight briefing-next">
          <h4>다음 일정</h4>
          <p>{calendar ? withoutCitations(calendar.text) : '확인된 공식 일정은 전체 브리핑에서 확인해 주세요.'}</p>
        </div>
      </div> : <ul className="briefing-summary-list">{item.summary.map((text,i)=><li key={i}>{text}</li>)}</ul>}

      <Link className="briefing-read" to={`/briefings/${item.id}`}>전체 브리핑 읽기 →</Link>
      <p className="briefing-meta">{item.reviewMode === 'automated' && <>AI 작성·자동 검토 · </>}{item.reviewMode === 'gemini-research' && <>Gemini 본문 요약·해석 · 자동 근거 대조 · </>}{item.reviewMode === 'gemini' && <>Gemini 제목 요약 · 자동 대조 · </>}{item.reviewMode === 'rules' && <>규칙 기반 자동 정리 · AI 미사용 · </>}가장 최근 게시된 브리핑 · 실시간 시황이 아닙니다.</p>
    </> : <div className="briefing-empty">
      <span className="briefing-edition">ANTHRACITE / DAILY</span>
      <h3>시장의 흐름과<br />다음 확인할 변화를 한곳에.</h3>
      <p>첫 브리핑을 준비하고 있습니다. 출처와 수치를 검토한 뒤 게시합니다.</p>
      <ul><li>미국장 마감과 이후의 주요 소식</li><li>경제·기업 뉴스의 의미와 변화</li><li>다음 경제지표와 실적 일정</li></ul>

    </div>}
  </section>
}
