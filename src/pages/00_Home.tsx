import { useEffect, useRef } from 'react'
import MarketCalendar from '../components/MarketCalendar'
import SectorPerformance from '../components/SectorPerformance'
import MarketTicker from '../components/MarketTicker'
import NewsFeed from '../components/NewsFeed'
import MarketMovers from '../components/MarketMovers'
import MarketLive from '../components/MarketLive'
import './Home.css'

export default function Home() {
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
      <div className="home-dashboard">
        <div className="home-dashboard-maps"><SectorPerformance compact /></div>
        <div className="home-dashboard-calendar"><MarketCalendar /></div>

      </div>
      <section className="home-news" aria-labelledby="home-news-title">
        <h2 id="home-news-title">Latest News</h2>
        <NewsFeed />
      </section>
      </div>
        <div className="home-dashboard-sidebar">
          <div className="home-dashboard-live"><MarketLive /></div>
          <div className="home-dashboard-movers" tabIndex={0} role="region" aria-label="Market Movers 목록"><MarketMovers /></div>
        </div>
    </main>
    <footer className="home-footer">Anthracite © 2026</footer>
  </div>
}
