import { useEffect, useRef, useState } from 'react'
import MarketCalendar from '../components/MarketCalendar'
import SectorPerformance from '../components/SectorPerformance'
import MarketTicker from '../components/MarketTicker'
import NewsFeed from '../components/NewsFeed'
import MarketMovers from '../components/MarketMovers'
import MarketLive from '../components/MarketLive'
import './Home.css'

export default function Home() {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 700px)').matches)
  const [panel, setPanel] = useState('Maps')
  const [expanded, setExpanded] = useState(true)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 700px)')
    const update = () => setMobile(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const content = useRef<HTMLElement>(null)
  useEffect(() => {
    const header = document.querySelector('.site-header')
    if (!header) return
    const update = () => content.current?.style.setProperty('--header-height', `${header.getBoundingClientRect().height}px`)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])
  return <div className="home-page">
    <MarketTicker />
    <main className="home-content" ref={content}>
      <div className="home-primary">
      {mobile ? <section className="home-mobile-market" aria-label="시장 정보">
        <div className="home-mobile-tabs" role="group" aria-label="시장 정보 선택">
          {['Maps', 'Calendar', 'Movers', 'Live'].map(name => <button type="button" key={name} aria-pressed={expanded && panel === name} aria-controls="home-mobile-panel" onClick={() => { setPanel(name); setExpanded(true) }}>{name}</button>)}
        </div>
        <div className="home-mobile-panel-actions"><a href="#home-news-title">기사 바로 보기 ↓</a><button type="button" aria-expanded={expanded} aria-controls="home-mobile-panel" onClick={() => setExpanded(!expanded)}>{expanded ? '접기 −' : '펼치기 +'}</button></div>
        <div id="home-mobile-panel" hidden={!expanded}>
          {expanded && (panel === 'Maps' ? <SectorPerformance compact /> : panel === 'Calendar' ? <MarketCalendar /> : panel === 'Movers' ? <div className="home-mobile-movers" tabIndex={0} role="region" aria-label="Market Movers 목록"><MarketMovers /></div> : <MarketLive autoPlay={false} />)}
        </div>
      </section> : <div className="home-dashboard">
        <div className="home-dashboard-maps"><SectorPerformance compact /></div>
        <div className="home-dashboard-calendar"><MarketCalendar /></div>

      </div>}
      <section className="home-news" aria-labelledby="home-news-title">
        <h2 id="home-news-title">Latest News</h2>
        <NewsFeed />
      </section>
      </div>
        {!mobile && <div className="home-dashboard-sidebar">
          <div className="home-dashboard-live"><MarketLive /></div>
          <div className="home-dashboard-movers" tabIndex={0} role="region" aria-label="Market Movers 목록"><MarketMovers /></div>
        </div>}
    </main>
    <footer className="home-footer">Anthracite © 2026</footer>
  </div>
}
