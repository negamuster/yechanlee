import { Link } from 'react-router-dom'
import MarketLive from '../components/MarketLive'

const groups = [
  { title: '시장·경제', links: [['/equity', '주식시장'], ['/rates', '금리·채권'], ['/fed', '연준·통화정책'], ['/indicators', '경제지표'], ['/macro', '글로벌 매크로']] },
  { title: '투자 도구·방송', links: [['/form13f', '기관 포트폴리오 · 13F'], ['/simulator', '자산 시뮬레이터'], ['/live', 'Yahoo Finance Live']] },
]
export default function More() {
  return <main className="more-page">
    <h1>더보기</h1>
    {groups.map(group => <section key={group.title} aria-label={group.title}>
      <h2>{group.title}</h2>
      {group.links.map(([to, label]) => <Link key={to} to={to}>{label}<span aria-hidden="true">›</span></Link>)}
    </section>)}
    <section aria-label="Contact"><h2>Contact</h2>
      <a href="mailto:yechan030102@gmail.com">yechan030102@gmail.com<span aria-hidden="true">↗</span></a>
      <a href="https://www.linkedin.com/in/yechanlee030102" target="_blank" rel="noopener noreferrer">LinkedIn<span aria-hidden="true">↗</span></a>
    </section>
  </main>
}
export function LivePage() {
  return <main className="live-page"><h1>Live</h1><MarketLive autoPlay={false} /></main>
}
