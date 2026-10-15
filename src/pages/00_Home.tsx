import { useEffect, useRef, useState } from 'react'
import { useSessionState } from '../hooks/useSessionState'
import { isNewsSector } from '../components/sectorNews'
import type { NewsSector } from '../components/sectorNews'
import MarketCalendar from '../components/MarketCalendar'
import SectorPerformance from '../components/SectorPerformance'
import MarketTicker from '../components/MarketTicker'
import NewsFeed from '../components/NewsFeed'
import MarketMovers from '../components/MarketMovers'
import MarketLive from '../components/MarketLive'
import DailyBriefing from '../components/DailyBriefing'
import './Home.css'

export default function Home() {
  const [newsTarget, setNewsTarget] = useState<HTMLDivElement | null>(null)
  const [newsSector, setNewsSector] = useSessionState<NewsSector | null>('news.previewSector', null, isNewsSector)
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
    <main className="home-content home-overview" ref={content}>
      <div className="home-primary">
        <div className={`home-widget home-briefing${mobile ? ' is-mobile' : ''}`}><DailyBriefing mobile={mobile} /></div>
        <section className="home-news" aria-labelledby="home-news-title">
          <h2 id="home-news-title" tabIndex={-1}>{mobile ? '최신 뉴스' : 'Latest News'}</h2>
          <NewsFeed previewTarget={newsTarget} previewSector={newsSector} onClearSector={() => setNewsSector(null)} />
        </section>
      </div>
      {!mobile && <>
        <aside className="home-market-column" aria-label="시장 흐름과 일정">
          <div className="home-widget home-dashboard-maps"><SectorPerformance compact selectedSector={newsSector?.symbol} onSelectSector={setNewsSector} /></div>
          <div className="home-widget home-dashboard-calendar" id="home-calendar" tabIndex={-1} role="region" aria-label="경제·실적 캘린더"><MarketCalendar /></div>
          <details className="home-widget home-sector-news"><summary>업종 관련 기사</summary><div ref={setNewsTarget} /></details>
        </aside>
        <aside className="home-dashboard-sidebar" data-scroll-key="home-sidebar" tabIndex={0} aria-label="종목 순위와 라이브 방송">
          <div className="home-widget home-dashboard-movers"><MarketMovers /></div>
          <div className="home-widget home-dashboard-live"><MarketLive /></div>
        </aside>
      </>}
    </main>
    <footer className="home-footer">Anthracite © 2026</footer>
  </div>
}
