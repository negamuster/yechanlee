import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import MarketOverview from '../components/MarketOverview'

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
  const [showArrow, setShowArrow] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const handleScroll = () => setShowArrow(window.scrollY < 80)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(10px); }
        }
        .slide-up-1 { opacity: 0; animation: slideUp 0.8s ease forwards 0.2s; }
        .slide-up-2 { opacity: 0; animation: slideUp 0.8s ease forwards 0.5s; }
        .slide-up-3 { opacity: 0; animation: slideUp 0.8s ease forwards 0.7s; }
        .scroll-arrow { animation: bounce 2s ease-in-out infinite; transition: opacity 0.4s ease; }
        .search-wrap input::placeholder { color: #bbb; }
        .search-wrap input:focus { outline: none; }
        .search-btn { transition: opacity 0.15s ease; }
        .search-btn:hover { opacity: 0.5; }
        .chip { transition: opacity 0.15s ease; cursor: pointer; }
        .chip:hover { opacity: 0.5; }
      `}</style>

      <div style={{ backgroundColor: '#ffffff', color: '#000000', fontFamily: '"Times New Roman", Times, serif' }}>

        {/* ── NAV ── */}
        <nav style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8e8e8' }}>
          <span style={{ fontSize: '22px', fontWeight: '600', letterSpacing: '-0.01em' }}>Anthracite</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '13px' }}>
            <span style={{ color: '#aaa' }}>Contact</span>
            <a href="mailto:yechan030102@gmail.com" style={{ color: '#000000', textDecoration: 'none', borderBottom: '1px solid #ccc' }}>
              yechan030102@gmail.com
            </a>
            <a href="https://www.linkedin.com/in/yechanlee030102" target="_blank" rel="noopener noreferrer" style={{ color: '#000000', textDecoration: 'none', borderBottom: '1px solid #ccc' }}>
              LinkedIn
            </a>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section style={{ minHeight: 'calc(100vh - 81px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '80px 48px 40px', position: 'relative' }}>
          <h1 className="slide-up-1" style={{ fontSize: 'clamp(40px, 6vw, 72px)', lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '400', marginBottom: '24px', color: '#000000', whiteSpace: 'nowrap' }}>
            Alphasight
          </h1>
          <p className="slide-up-2" style={{ fontSize: '17px', lineHeight: '1.75', color: '#000000', maxWidth: '480px', marginBottom: '40px' }}>
            시장을 꿰뚫어 보다
          </p>

          {/* ── SEARCH BAR ── */}
          <div className="slide-up-3" style={{ width: '100%', maxWidth: '560px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '64px' }}>
            <div className="search-wrap" style={{ width: '100%', position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="#aaa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', left: '18px', pointerEvents: 'none', flexShrink: 0 }}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>

              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="종목명 또는 티커 검색  (NVDA, GOOGL...)"
                style={{
                  width: '100%',
                  padding: '16px 60px 16px 50px',
                  fontSize: '15px',
                  fontFamily: '"Times New Roman", Times, serif',
                  border: '1px solid #000',
                  borderRadius: '0',
                  backgroundColor: '#fff',
                  color: '#000',
                  boxSizing: 'border-box',
                }}
              />

              <button
                onClick={handleSearch}
                className="search-btn"
                style={{
                  position: 'absolute', right: '0',
                  height: '100%', padding: '0 20px',
                  background: '#000', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ fontSize: '12px', color: '#bbb', letterSpacing: '0.05em' }}>바로가기</span>
              {['NVDA', 'AAPL', 'TSLA', 'GOOGL', 'MSFT'].map(t => (
                <span
                  key={t}
                  className="chip"
                  onClick={() => navigate(`/stock/${t}`)}
                  style={{ fontSize: '12px', color: '#888', border: '1px solid #e8e8e8', padding: '4px 10px' }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* ── MARKET OVERVIEW ── */}
          <div className="slide-up-3" style={{ width: '100%', maxWidth: '1100px' }}>
            <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '16px', textAlign: 'left' }}>
              Market Overview
            </p>
            <MarketOverview onSelect={(ticker) => navigate(`/stock/${ticker}`)} />
          </div>

          {/* 스크롤 화살표 */}
          <div
            className="scroll-arrow"
            style={{ position: 'absolute', bottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: showArrow ? 1 : 0, pointerEvents: showArrow ? 'auto' : 'none' }}
            onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
          >
            <span style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa' }}>Scroll</span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
          </div>
        </section>

        {/* ── MAIN GRID: Indicators + Tools ── */}
        <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 48px 0' }}>
          <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '64px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 80px', alignItems: 'start' }}>

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
        <footer style={{ borderTop: '1px solid #e8e8e8', padding: '32px 48px', marginTop: '120px', fontSize: '12px', color: '#aaa' }}>
          <span>Anthracite © 2026</span>
        </footer>

      </div>
    </>
  )
}