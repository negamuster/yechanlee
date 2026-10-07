import { Link, useParams } from 'react-router-dom'
import { briefings, kstTime } from '../lib/briefings'
import '../components/DailyBriefing.css'
export default function Briefings() {
  const { date } = useParams()
  const item = briefings.find(x=>x.id===date)
  if (date === 'methodology') return <main className="briefing-article"><Link to="/briefings">← 브리핑 목록</Link><h1>브리핑 작성 원칙</h1>
    <h2>정보 기준과 출처</h2><p>정보 기준 시각과 게시 시각을 구분합니다. 직전 미국 정규장과 이후 소식을 나누고, 시장 수치에는 거래일·시간대·종가 또는 보도 기준을 표시합니다.</p><p>공식 통계·중앙은행·기업 공시를 우선 확인하고 언론 보도로 맥락을 보완합니다. 동일 통신사의 재배포는 독립된 확인으로 세지 않습니다. 지수·만기·단위·기간이 다른 수치를 같은 값처럼 비교하지 않습니다.</p>
    <h2>사실과 해석</h2><p>시장 의미와 핵심 변화 해석은 Anthracite의 분석입니다. 외부 의견과 회사 전망에는 주체를 명시합니다. 가격 변화와 뉴스의 동시 발생만으로 인과관계를 단정하지 않으며, 전망을 실현된 성과로 표현하지 않습니다.</p>
    <h2>게시와 정정</h2><p>초안 작성과 근거 검토 후 게시합니다. 2026년 10월 8일부터 일일 발행은 AI 없이 뉴스 피드의 원문 제목·링크, 공식 금리와 일정을 규칙으로 정리합니다. 기사 본문 검증·번역·시장 해석은 하지 않습니다. 날짜·중복·출처·데이터 형식 검사는 내용의 사실검증과 다릅니다. 과거 AI 작성본은 기존 표시를 유지합니다. 새 원고가 준비되지 않으면 기존 게시물의 내용과 날짜를 유지합니다. 게시 후 중요한 변경에는 정정 이력을 남깁니다.</p><p className="briefing-meta">시장 정보와 분석을 제공하며 특정 투자상품의 매수·매도를 권유하지 않습니다.</p></main>
  if (!date) return <main className="briefing-archive"><Link to="/">← 홈</Link><h1>Daily Market Briefing</h1><p>거래일과 작성 기준 시각을 확인하고 지난 시장 흐름을 읽어보세요.</p><Link to="/briefings/methodology">작성 원칙 →</Link>{briefings.length ? <ol>{briefings.map(x=><li key={x.id}><Link to={`/briefings/${x.id}`}>{x.title}</Link><p>{x.sessionDate ? `미국 거래일 ${x.sessionDate}` : '뉴스·공식 지표 모음'} · {kstTime(x.cutoffAt)}</p></li>)}</ol> : <p>아직 게시된 브리핑이 없습니다. 첫 원고의 출처와 수치를 검토하고 있습니다.</p>}</main>
  if (!item) return <main className="briefing-archive"><h1>게시된 브리핑을 찾을 수 없습니다.</h1><Link to="/briefings">브리핑 목록으로 →</Link></main>
  return <main className="briefing-article"><Link to="/briefings">← 지난 브리핑</Link><h1>{item.title}</h1><p className="briefing-meta">{item.sessionDate ? `미국 거래일 ${item.sessionDate}` : '뉴스·공식 지표 모음'}<br />정보 기준 {kstTime(item.cutoffAt)}<br />게시 {kstTime(item.publishedAt)}{item.reviewMode === 'automated' && <><br />AI 작성·자동 검토</>}{item.reviewMode === 'rules' && <><br />규칙 기반 자동 정리 · AI 미사용</>}</p>
    {item.blocks.map((b,i)=>b.kind==='heading'?<h2 key={i}>{b.text}</h2>:b.kind==='subheading'?<h3 key={i}>{b.text}</h3>:b.kind==='metadata'?<div className="briefing-tags" key={i}>{b.text.split(' · ').map((tag,j)=><span key={j}>{tag}</span>)}</div>:<p key={i}>{b.text}</p>)}
    <p className="briefing-meta">{item.dataNote}</p><Link to="/briefings/methodology">작성 원칙 →</Link><section className="briefing-sources"><h2>출처</h2><ol>{item.sources.map(s=><li id={`source-${s.id}`} key={s.id} value={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label} ↗</a>{s.accessNote && <span className="briefing-access">{s.accessNote}</span>}{s.links?.map(link=><a className="briefing-source-alternate" key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>)}</li>)}</ol></section>
    {!!item.corrections.length && <details><summary>정정 이력</summary>{item.corrections.map((c,i)=><p key={i}>{kstTime(c.at)} · {c.text}</p>)}</details>}
    <p className="briefing-meta">시장 정보와 분석을 제공하며 특정 투자상품의 매수·매도를 권유하지 않습니다.</p>
  </main>
}
