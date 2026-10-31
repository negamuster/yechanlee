import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSessionState } from '../hooks/useSessionState'
import { isNewsSector } from '../components/sectorNews'
import type { NewsSector } from '../components/sectorNews'
import MarketCalendar from '../components/MarketCalendar'
import SectorPerformance from '../components/SectorPerformance'
import MarketTicker from '../components/MarketTicker'
import MarketSessionStatus from '../components/MarketSessionStatus'
import NewsFeed from '../components/NewsFeed'
import MarketMovers from '../components/MarketMovers'
import MarketLive from '../components/MarketLive'
import HomeBriefing from '../components/HomeBriefing'
import LinkedWidget from '../components/LinkedWidget'
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
    <MarketSessionStatus />
    <main className="home-content home-overview" ref={content}>
      <header className="home-section-heading">
        <div><h1>오늘의 시장</h1><p>시장 흐름과 오늘의 핵심 소식을 확인하세요.</p></div>
        <nav className="home-section-links" aria-label="오늘의 시장 바로가기">
          <a href="#home-news-title">최신 뉴스</a><Link to="/markets">시장 전체</Link><Link to="/calendar">오늘의 일정</Link>
        </nav>
      </header>
      <div className="home-primary">
        <LinkedWidget className={`home-widget home-briefing${mobile ? ' is-mobile' : ''}`}><HomeBriefing mobile={mobile} /></LinkedWidget>
        <section className="home-news" aria-labelledby="home-news-title">
          <h2 id="home-news-title" className="widget-title" tabIndex={-1}>{mobile ? '최신 뉴스' : 'Latest News'}</h2>
          <NewsFeed compact mobile={mobile} previewTarget={newsTarget} previewSector={newsSector} onClearSector={() => setNewsSector(null)} />
        </section>
      </div>
      {!mobile && <>
        <aside className="home-market-column" aria-label="시장 흐름과 일정">
          <LinkedWidget className="home-widget home-dashboard-maps"><SectorPerformance compact selectedSector={newsSector?.symbol} onSelectSector={setNewsSector} /></LinkedWidget>
          <LinkedWidget className="home-widget home-dashboard-calendar" id="home-calendar" tabIndex={-1} role="region" aria-label="경제·실적 캘린더"><MarketCalendar /></LinkedWidget>
          <details className="home-widget home-sector-news"><summary>업종 관련 기사</summary><div ref={setNewsTarget} /></details>
        </aside>
        <aside className="home-dashboard-sidebar" data-scroll-key="home-sidebar" tabIndex={0} aria-label="종목 순위와 라이브 방송">
          <LinkedWidget className="home-widget home-dashboard-movers"><MarketMovers overview /></LinkedWidget>
          <LinkedWidget className="home-widget home-dashboard-live"><MarketLive compact /></LinkedWidget>
        </aside>
      </>}
    </main>
    <footer className="home-footer">Anthracite © 2026</footer>
  </div>
}
