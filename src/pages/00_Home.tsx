import { useEffect, useRef, useState } from 'react'
import type { NewsSector } from '../components/sectorNews'
import MarketCalendar from '../components/MarketCalendar'
import SectorPerformance from '../components/SectorPerformance'
import MarketTicker from '../components/MarketTicker'
import NewsFeed from '../components/NewsFeed'
import MarketMovers from '../components/MarketMovers'
import MarketLive from '../components/MarketLive'
import './Home.css'

export default function Home() {
  const [newsTarget, setNewsTarget] = useState<HTMLDivElement | null>(null)
  const [newsSector, setNewsSector] = useState<NewsSector | null>(null)
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 700px)').matches)
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
    {!mobile && <MarketTicker />}
    <main className="home-content" ref={content}>
      <div className="home-primary">
      {!mobile && <div className="home-dashboard">
        <div className="home-dashboard-maps"><SectorPerformance compact selectedSector={newsSector?.symbol} onSelectSector={setNewsSector} /><div ref={setNewsTarget} /></div>
        <div className="home-dashboard-calendar"><MarketCalendar /></div>

      </div>}
      <section className="home-news" aria-labelledby="home-news-title">
        <h2 id="home-news-title" tabIndex={-1}>Latest News</h2>
        <NewsFeed previewTarget={newsTarget} previewSector={newsSector} onClearSector={() => setNewsSector(null)} />
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
