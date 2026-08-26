import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import MarketOverview from '../components/MarketOverview'
import NewsFeed from '../components/NewsFeed'

const indicators = [
  {
    num: '01',
    title: 'Stock Market',
    desc: '글로벌 주식시장의 지수를 통해 시장의 전반적인 흐름과 구조를 한눈에 파악합니다.',
    path: '/equity',
  },
  {
    num: '02',
    title: 'Rates & Bond Market',
    desc: '국채 금리와 채권 시장을 통해 금리 환경과 시장의 전반적인 흐름을 읽습니다.',
    path: '/rates',
  },
  {
    num: '03',
    title: 'Fed & Monetary Policy',
    desc: 'Fed의 통화정책 결정 구조와 금리 사이클이 시장에 미치는 영향을 살펴봅니다.',
    path: '/fed',
  },
  {
    num: '04',
    title: 'Economic Indicators',
    desc: 'GDP, 물가, 고용 등 핵심 경제지표를 통해 현재 경기 국면과 시장의 방향성을 진단합니다.',
    path: '/indicators',
  },
  {
    num: '05',
    title: 'Global Macro',
    desc: '환율, 원자재, 시장 심리 등 글로벌 자금의 흐름과 리스크 환경의 변화를 함께 살펴보며 시장 전반의 방향성을 이해합니다.',
    path: '/macro',
  },
]

export default function Home() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = () => {
    const q = searchQuery.trim().toUpperCase()
    if (q) navigate(`/stock/${q}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <>
      <style>{`
        .nav-search-wrap input::placeholder { color: #bbb; }
        .nav-search-wrap input:focus { outline: none; }
        .nav-search-btn { transition: opacity 0.15s ease; }
        .nav-search-btn:hover { opacity: 0.6; }
        .footer-link { transition: opacity 0.15s ease; }
        .footer-link:hover { opacity: 0.5; }
        @media (max-width: 860px) {
          .home-main-grid { grid-template-columns: 1fr !important; }
          .home-market-col { order: -1; }
        }
        @media (max-width: 560px) {
          .nav-search-wrap { width: 100% !important; }
          .main-nav { flex-wrap: wrap; }
        }
      `}</style>

      <div style={{ backgroundColor: '#ffffff', color: '#000000', fontFamily: '"Times New Roman", Times, serif' }}>

        {/* ── NAV: sticky, 로고 + 오른쪽으로 이동한 넓은 검색창 ── */}
        <nav className="main-nav" style={{
          position: 'sticky', top: 0, zIndex: 50, backgroundColor: '#ffffff',
          padding: '18px 48px', display: 'flex', alignItems: 'center', gap: '48px',
          borderBottom: '1px solid #e8e8e8',
        }}>
          <span
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{ fontSize: '22px', fontWeight: '600', letterSpacing: '-0.01em', cursor: 'pointer', flexShrink: 0 }}
          >
            Anthracite
          </span>

          <div className="nav-search-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '440px', maxWidth: '50vw' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: '16px', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="종목명 또는 티커 검색 (NVDA, AAPL...)"
              style={{
                width: '100%',
                padding: '10px 44px 10px 40px',
                fontSize: '13px',
                fontFamily: '"Times New Roman", Times, serif',
                border: '1px solid #e0e0e0',
                borderRadius: '999px',
                background: '#fafafa',
                color: '#000',
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleSearch}
              className="nav-search-btn"
              style={{
                position: 'absolute', right: '4px', top: '4px', bottom: '4px',
                width: '30px',
                borderRadius: '50%',
                background: '#000', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </nav>

        {/* ── MAIN: News (좌) + Market Overview (우, 2열 박스 그리드) ── */}
        <section style={{ maxWidth: '1600px', margin: '0 auto', padding: '48px 40px 0' }}>
          <div className="home-main-grid" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '64px', alignItems: 'start' }}>

            {/* 좌측: 최신 뉴스 */}
            <div>
              <p style={{ fontSize: '20px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#000000', marginBottom: '28px' }}>
                Latest News
              </p>
              <NewsFeed />
            </div>

            {/* 우측: 주요 지수 (2열 박스, 차트 포함) */}
            <div className="home-market-col">
              <p style={{ fontSize: '20px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#000000', marginBottom: '28px' }}>
                Market Overview
              </p>
              <MarketOverview variant="grid" onSelect={(ticker) => navigate(`/stock/${ticker}`)} />
            </div>

          </div>
        </section>

        {/* ── MAIN GRID: Indicators + Tools ── */}
        <section style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 40px 0' }}>
          <div style={{ borderTop: '1px solid #e8e8e8', marginTop: '80px', paddingTop: '64px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 100px', alignItems: 'start', maxWidth: '1240px' }}>

            {/* 왼쪽: Indicators */}
            <div>
              <p style={{ fontSize: '20px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#000000', marginBottom: '48px' }}>
                Indicators
              </p>
              {indicators.map((item) => (
                <div
                  key={item.num}
                  onClick={() => navigate(item.path)}
                  style={{ padding: '32px 0', borderBottom: '1px solid #e8e8e8', cursor: 'pointer', transition: 'opacity 0.15s ease' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.4')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '14px', color: '#000000', minWidth: '24px' }}>{item.num}</span>
                    <p style={{ fontSize: '22px', fontWeight: '400', color: '#000000' }}>{item.title}</p>
                  </div>
                  <p style={{ fontSize: '14px', lineHeight: '1.75', color: '#000000', paddingLeft: '40px', textAlign: 'justify', wordBreak: 'keep-all' }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* 오른쪽: Tools */}
            <div>
              <p style={{ fontSize: '20px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#000000', marginBottom: '48px' }}>
                Tools
              </p>

              {/* Simulator */}
              <div
                onClick={() => navigate('/simulator')}
                style={{ padding: '32px 0', borderBottom: '1px solid #e8e8e8', cursor: 'pointer', transition: 'opacity 0.15s ease' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.4')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <p style={{ fontSize: '22px', fontWeight: '400', color: '#000000', marginBottom: '10px' }}>
                  자산 시뮬레이터
                </p>
                <p style={{ fontSize: '14px', lineHeight: '1.75', color: '#000000', textAlign: 'justify', wordBreak: 'keep-all' }}>
                  나는 몇 살에 재정적으로 자유로워질 수 있을까?
                </p>
              </div>

              {/* Form 13F */}
              <div
                onClick={() => navigate('/form13f')}
                style={{ padding: '32px 0', borderBottom: '1px solid #e8e8e8', cursor: 'pointer', transition: 'opacity 0.15s ease' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.4')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <p style={{ fontSize: '22px', fontWeight: '400', color: '#000000', marginBottom: '10px' }}>
                  Form 13F
                </p>
                <p style={{ fontSize: '14px', lineHeight: '1.75', color: '#000000', textAlign: 'justify', wordBreak: 'keep-all' }}>
                  워런 버핏, 마이클 버리, 캐시 우드 등 주요 기관투자자들의 포트폴리오를 SEC Form 13F 공시를 통해 확인합니다.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: '1px solid #e8e8e8', padding: '40px 48px', marginTop: '120px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <span style={{ fontSize: '12px', color: '#aaa' }}>Anthracite © 2026</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '13px' }}>
              <span style={{ color: '#aaa' }}>Contact</span>
              <a href="mailto:yechan030102@gmail.com" className="footer-link" style={{ color: '#000000', textDecoration: 'none', borderBottom: '1px solid #ccc' }}>
                yechan030102@gmail.com
              </a>
              <a href="https://www.linkedin.com/in/yechanlee030102" target="_blank" rel="noopener noreferrer" className="footer-link" style={{ color: '#000000', textDecoration: 'none', borderBottom: '1px solid #ccc' }}>
                LinkedIn
              </a>
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}