import { Link } from 'react-router-dom'
import MarketTicker from '../components/MarketTicker'
import SectorPerformance from '../components/SectorPerformance'
import MarketMovers from '../components/MarketMovers'
import './Home.css'

export default function Markets() {
  return <div className="home-page">
    <MarketTicker />
    <main className="home-content market-hub">
      <h1>시장</h1>
      <div className="market-hub-grid">
        <section aria-label="업종별 성과"><SectorPerformance compact /><Link className="market-hub-link" to="/equity">주식시장 자세히 보기 →</Link></section>
        <section aria-label="Market Movers"><MarketMovers /></section>
      </div>
    </main>
  </div>
}
