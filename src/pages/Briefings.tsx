import { Link, useParams } from 'react-router-dom'
import { briefings, kstTime } from '../lib/briefings'
import '../components/DailyBriefing.css'
export default function Briefings() {
  const { date } = useParams()
  const item = briefings.find(x=>x.id===date)
  if (!date) return <main className="briefing-archive"><Link to="/">← 홈</Link><h1>Daily Market Briefing</h1><p>거래일과 작성 기준 시각을 확인하고 지난 시장 흐름을 읽어보세요.</p>{briefings.length ? <ol>{briefings.map(x=><li key={x.id}><Link to={`/briefings/${x.id}`}>{x.title}</Link><p>미국 거래일 {x.sessionDate} · {kstTime(x.cutoffAt)}</p></li>)}</ol> : <p>아직 게시된 브리핑이 없습니다. 첫 원고의 출처와 수치를 검토하고 있습니다.</p>}</main>
  if (!item) return <main className="briefing-archive"><h1>게시된 브리핑을 찾을 수 없습니다.</h1><Link to="/briefings">브리핑 목록으로 →</Link></main>
  return <main className="briefing-article"><Link to="/briefings">← 지난 브리핑</Link><h1>{item.title}</h1><p className="briefing-meta">미국 거래일 {item.sessionDate}<br />정보 기준 {kstTime(item.cutoffAt)}<br />게시 {kstTime(item.publishedAt)}</p>
    {item.blocks.map((b,i)=>b.kind==='heading'?<h2 key={i}>{b.text}</h2>:b.kind==='subheading'?<h3 key={i}>{b.text}</h3>:<p key={i}>{b.text}</p>)}
    <p>{item.dataNote}</p><section className="briefing-sources"><h2>출처</h2><ol>{item.sources.map(s=><li key={s.id} value={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label} ↗</a></li>)}</ol></section>
    {!!item.corrections.length && <details><summary>정정 이력</summary>{item.corrections.map((c,i)=><p key={i}>{kstTime(c.at)} · {c.text}</p>)}</details>}
    <p className="briefing-meta">시장 정보와 분석을 제공하며 특정 투자상품의 매수·매도를 권유하지 않습니다.</p>
  </main>
}
