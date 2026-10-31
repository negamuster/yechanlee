import { Link } from 'react-router-dom'
import { BookOpen, BriefcaseBusiness, CalendarDays, ChartNoAxesCombined, ChevronRight, FileSearch, Globe, Landmark, Radio, SlidersHorizontal, TrendingUp, Wallet } from 'lucide-react'
import { marketLinks, toolLinks } from '../lib/navigation'
import MarketLive from '../components/MarketLive'

const icons = [TrendingUp, Landmark, Landmark, ChartNoAxesCombined, Globe, CalendarDays, FileSearch, BriefcaseBusiness, Wallet]
const groups = [
  { title: '시장·경제', links: marketLinks.map((item, index) => ({ ...item, Icon: icons[index] })) },
  { title: '투자 도구', links: toolLinks.map((item, index) => ({ ...item, Icon: icons[marketLinks.length + index] })) },
  { title: '브리핑·방송', links: [{ to: '/briefings', label: 'Daily Market Briefing', Icon: BookOpen }, { to: '/live', label: 'Yahoo Finance Live', Icon: Radio }] },
]
export default function More() {
  return <main className="more-page">
    <header className="more-page-heading"><h1>더보기</h1><p>시장 정보와 투자 도구를 한곳에서 찾아보세요.</p></header>
    {groups.map(group => <section key={group.title} aria-label={group.title}>
      <h2>{group.title}</h2>
      {group.links.map(({ to, label, Icon }) => <Link key={to} to={to}>
        <span className="more-link-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.8} focusable="false" /></span>
        <span className="more-link-label">{label}</span><ChevronRight size={16} aria-hidden="true" focusable="false" />
      </Link>)}
    </section>)}
    <section aria-label="홈 화면에 추가"><h2><SlidersHorizontal size={16} aria-hidden="true" focusable="false" />앱처럼 열기</h2><details className="install-help"><summary>홈 화면에 추가하는 방법 ＋</summary><p>iPhone · Safari의 공유 메뉴에서 ‘홈 화면에 추가’를 선택하세요.</p><p>Android · Chrome 메뉴에서 ‘홈 화면에 추가’ 또는 ‘앱 설치’를 선택하세요.</p><p>추가한 Anthracite 아이콘을 누르면 뉴스 화면부터 열립니다. 뉴스·시세·일정 조회에는 인터넷 연결이 필요합니다.</p></details></section>
    <section aria-label="Contact"><h2>Contact</h2>
      <a href="https://negamuster.github.io/" target="_blank" rel="noopener noreferrer">Personal Profile<span aria-hidden="true">↗</span></a>
      <a href="https://www.linkedin.com/in/yechanlee030102" target="_blank" rel="noopener noreferrer">LinkedIn<span aria-hidden="true">↗</span></a>
    </section>
  </main>
}
export function LivePage() {
  return <main className="live-page"><h1>Live</h1><MarketLive autoPlay={false} /></main>
}
