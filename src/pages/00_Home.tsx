import MarketCalendar from '../components/MarketCalendar'
import SectorPerformance from '../components/SectorPerformance'
import MarketTicker from '../components/MarketTicker'
import NewsFeed from '../components/NewsFeed'
import MarketMovers from '../components/MarketMovers'
import MarketLive from '../components/MarketLive'
import './Home.css'

export default function Home() {
  return <div className="home-page">
    <MarketTicker />
    <main className="home-content">
      <div className="home-dashboard">
        <div className="home-dashboard-movers" tabIndex={0} role="region" aria-label="Market Movers 목록"><MarketMovers /></div>
        <div className="home-dashboard-maps"><SectorPerformance compact /></div>
        <div className="home-dashboard-live"><MarketLive /><MarketCalendar /></div>
      </div>
      <section className="home-news" aria-labelledby="home-news-title">
        <h2 id="home-news-title">Latest News</h2>
        <NewsFeed />
      </section>
    </main>
    <footer className="home-footer">Anthracite © 2026</footer>
  </div>
}
