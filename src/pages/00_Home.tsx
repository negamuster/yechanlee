import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

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

  useEffect(() => {
    const handleScroll = () => {
      setShowArrow(window.scrollY < 80)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
        .scroll-arrow { animation: bounce 2s ease-in-out infinite; transition: opacity 0.4s ease; }
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
        <section style={{ height: 'calc(100vh - 81px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 48px', position: 'relative' }}>
          <h1 className="slide-up-1" style={{ fontSize: 'clamp(40px, 6vw, 72px)', lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '400', marginBottom: '24px', color: '#000000', whiteSpace: 'nowrap' }}>
            So You See Clarity
          </h1>
          <p className="slide-up-2" style={{ fontSize: '17px', lineHeight: '1.75', color: '#000000', maxWidth: '480px' }}>
            경제와 시장의 흐름을 더 명확하게 이해할 수 있도록
          </p>
          <div
            className="scroll-arrow"
            style={{ position: 'absolute', bottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: showArrow ? 1 : 0, pointerEvents: showArrow ? 'auto' : 'none' }}
            onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
          >
            <span style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa' }}>Scroll</span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
          </div>
        </section>

        {/* ── INDICATORS ── */}
        <section style={{ maxWidth: '720px', margin: '0 auto', padding: '0 48px 0' }}>
          <p style={{ fontSize: '20px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#000000', marginBottom: '48px', borderTop: '1px solid #e8e8e8', paddingTop: '64px' }}>
            Indicators
          </p>
          {indicators.map((item) => (
            <div
              key={item.num}
              onClick={() => navigate(item.path)}
              style={{ padding: '40px 0', borderBottom: '1px solid #e8e8e8', cursor: 'pointer', transition: 'opacity 0.15s ease' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.4')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px', marginBottom: '14px' }}>
                <span style={{ fontSize: '16px', color: '#000000', minWidth: '24px' }}>{item.num}</span>
                <p style={{ fontSize: '28px', fontWeight: '400', color: '#000000' }}>{item.title}</p>
              </div>
              <p style={{ fontSize: '15px', lineHeight: '1.75', color: '#000000', paddingLeft: '44px', textAlign: 'justify', wordBreak: 'keep-all' }}>
                {item.desc}
              </p>
            </div>
          ))}
        </section>

        {/* ── SIMULATOR ── */}
        <section style={{ maxWidth: '720px', margin: '0 auto', padding: '0 48px 160px' }}>
          <div
            onClick={() => navigate('/simulator')}
            style={{ paddingTop: '64px', cursor: 'pointer', transition: 'opacity 0.15s ease' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.4')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <p style={{ fontSize: '20px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#000000', marginBottom: '48px', borderTop: '1px solid #e8e8e8', paddingTop: '64px' }}>
              Simulator
            </p>
            <p style={{ fontSize: '15px', lineHeight: '1.75', color: '#000000', textAlign: 'justify', wordBreak: 'keep-all' }}>
              나이, 자산, 소득, 소비, 부채를 입력하면 100세까지의 순자산 추이를 예측합니다.
            </p>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: '1px solid #e8e8e8', padding: '32px 48px', fontSize: '12px', color: '#aaa' }}>
          <span>Anthracite © 2026</span>
        </footer>

      </div>
    </>
  )
}