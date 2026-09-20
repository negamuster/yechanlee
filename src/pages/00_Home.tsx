import MarketTicker from '../components/MarketTicker'
import NewsFeed from '../components/NewsFeed'
import MarketMovers from '../components/MarketMovers'
import MarketLive from '../components/MarketLive'

export default function Home() {
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
        <MarketTicker />

        {/* ── MAIN: News (좌) + Market Overview (우, 2열 박스 그리드) ── */}
        <section style={{ maxWidth: '1600px', margin: '0 auto', padding: '48px 40px 0' }}>
          <div className="home-main-grid" style={{ display: 'grid', gridTemplateColumns: '1.7fr 0.9fr', gap: '64px', alignItems: 'start' }}>

            {/* 좌측: 최신 뉴스 */}
            <div>
              <p style={{ fontSize: '20px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#000000', marginBottom: '28px' }}>
                Latest News
              </p>
              <NewsFeed />
            </div>

            {/* 우측: 주요 지수 (2열 박스, 차트 포함) */}
            <div className="home-market-col">
              <MarketLive />
              <MarketMovers />
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
