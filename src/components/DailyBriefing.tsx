import { Link } from 'react-router-dom'
import { useId } from 'react'
import { useSessionState } from '../hooks/useSessionState'
import { latestBriefing, kstTime } from '../lib/briefings'
import type { Briefing } from '../lib/briefings'
import './DailyBriefing.css'
function SourceRefs({ item, ids }: { item: Briefing; ids: number[] }) {
  return <sup className="briefing-citations">{ids.map(id => <Link key={id} to={`/briefings/${item.id}#source-${id}`} aria-label={`출처 ${id}: ${item.sources.find(s => s.id === id)?.label ?? ''}`}>[{id}]</Link>)}</sup>
}
function CitedText({ item, text }: { item: Briefing; text: string }) {
  return <>{text.split(/(\[\d+\])/g).map((part, i) => /^\[\d+\]$/.test(part) ? <SourceRefs key={i} item={item} ids={[Number(part.slice(1, -1))]} /> : part)}</>
}
const trendClass = (change: string) => /[-−](?:US\$|\$)?\s*\d/.test(change) ? 'briefing-down' : /\+(?:US\$|\$)?\s*\d/.test(change) ? 'briefing-up' : ''
const eventTime = (at: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at))

export default function DailyBriefing() {
  const [detail, setDetail] = useSessionState<'stocks' | 'assets' | 'events'>('briefing.detail', 'stocks', v => ['stocks', 'assets', 'events'].includes(String(v)))
  const detailId = useId()
  const item = latestBriefing
  const home = item?.homepage
  const sections = [
    { key: 'stocks' as const, label: '주요 종목', count: home?.stocks.length ?? 0 },
    { key: 'assets' as const, label: '자산 흐름', count: home?.assets.length ?? 0 },
    { key: 'events' as const, label: '오늘·다음 일정', count: home?.events.length ?? 0 },
  ].filter(section => section.count > 0)
  const activeDetail = sections.some(section => section.key === detail) ? detail : sections[0]?.key
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
      <h3><Link to={`/briefings/${item.id}`}>{withoutCitations(home?.headline ?? item.title)}</Link></h3>
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
      </div> : <ul className="briefing-summary-list">{item.summary.map((text,i)=><li key={i}><CitedText item={item} text={text} /></li>)}</ul>}

      {home && <div className="briefing-expanded">
        {!!sections.length && <div className="briefing-detail-tabs" role="group" aria-label="브리핑 상세 보기">
          {sections.map(section => <button type="button" key={section.key} aria-pressed={activeDetail === section.key} aria-controls={detailId} onClick={() => setDetail(section.key)}>{section.label} <span>{section.count}</span></button>)}
        </div>}
        <div id={detailId} className="briefing-detail-panel">
        {activeDetail === 'stocks' && <section className="briefing-section" aria-labelledby="briefing-stocks-title">
          <div className="briefing-section-heading"><h4 id="briefing-stocks-title">주요 종목</h4><span>움직임과 배경</span></div>
          <ul className="briefing-stocks">{home.stocks.map(stock => <li key={stock.ticker}>
            <div className="briefing-stock-heading"><strong>{stock.name} <span>{stock.ticker}</span></strong><b className={trendClass(stock.change)}>{stock.change}</b></div>
            <p>{stock.reason}<SourceRefs item={item} ids={stock.sourceIds} /></p>
            <small>{stock.basis}</small>
          </li>)}</ul>
        </section>}
          {activeDetail === 'assets' && <section className="briefing-section" aria-labelledby="briefing-assets-title">
            <div className="briefing-section-heading"><h4 id="briefing-assets-title">자산 흐름</h4><span>아침 브리핑 기준</span></div>
            <table className="briefing-assets"><caption>자산별 관측 시각과 비교 기준이 다릅니다.</caption>
              <thead><tr><th scope="col">자산 · 관측 기준</th><th scope="col">수치</th><th scope="col">변화</th></tr></thead>
              <tbody>{home.assets.map(asset => <tr key={asset.label}>
                <th scope="row">{asset.label}<SourceRefs item={item} ids={asset.sourceIds} /><span>{asset.basis}</span></th>
                <td>{asset.value}</td><td className={trendClass(asset.change)}>{asset.change}</td>
              </tr>)}</tbody>
            </table>
          </section>}
          {activeDetail === 'events' && <section className="briefing-section" aria-labelledby="briefing-events-title">
            <div className="briefing-section-heading"><h4 id="briefing-events-title">오늘·다음 일정</h4><span>발행일 기준 · KST</span></div>
            <ol className="briefing-events">{home.events.map(event => <li key={`${event.at}-${event.label}`}>
              <time dateTime={event.at}>{eventTime(event.at)}</time>
              <p>{event.label}<SourceRefs item={item} ids={event.sourceIds} /></p>
              {event.detail && <small>{event.detail}</small>}
            </li>)}</ol>
          </section>}
        </div>
      </div>}

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
