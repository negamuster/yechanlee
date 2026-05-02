import { useNavigate } from 'react-router-dom'

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
    desc: '국채 금리와 채권 시장을 통해 금리 환경과 시장의 전반적인 흐름을 파악합니다.',
    path: '/treasury',
  },
  {
    num: '03',
    title: 'Fed & Monetary Policy',
    desc: 'FOMC의 정책 결정을 중심으로 중앙은행이 금리와 유동성 조절을 통해 통화정책을 운용하는 방식과 그 영향이 시장에 어떻게 영향을 미치는지 구조적으로 살펴봅니다.',
    path: '/rates',
  },
  {
    num: '04',
    title: 'Economic Indicators',
    desc: '주요 경제 지표를 통해 경기 흐름과 경제 전반의 상태를 파악합니다.',
    path: '/fred',
  },
  {
    num: '05',
    title: 'Global Macro',
    desc: '환율과 원자재 시장을 통해 글로벌 자금 흐름과 거시 경제 환경을 파악하고, 주요 국가의 정책과 경제 변수 간 상호작용이 시장에 미치는 영향을 살펴봅니다.',
    path: '/macro',
  },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div style={{ backgroundColor: '#ffffff', color: '#000000', fontFamily: '"Times New Roman", Times, serif' }}>

      {/* ── NAV ── */}
      <nav style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8e8e8' }}>
        <span style={{ fontSize: '18px', fontWeight: '600', letterSpacing: '-0.01em', color: '#000000' }}>Anthracite</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '13px', color: '#000000' }}>
          <span>Contact</span>
          <a
            href="mailto:yechan030102@gmail.com"
            style={{ color: '#000000', textDecoration: 'none', borderBottom: '1px solid #ccc' }}
          >
            yechan030102@gmail.com
          </a>
          <a
            href="https://www.linkedin.com/in/yechanlee030102"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#000000', textDecoration: 'none', borderBottom: '1px solid #ccc' }}
          >
            LinkedIn
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        height: 'calc(100vh - 81px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        padding: '0 48px',
      }}>
        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 60px)',
          lineHeight: '1.05',
          letterSpacing: '-0.02em',
          fontWeight: '400',
          marginBottom: '24px',
          color: '#000000',
          whiteSpace: 'nowrap',
        }}>
          Make Economics & Finance Easy
        </h1>
        <p style={{ fontSize: '17px', lineHeight: '1.75', color: '#000000', maxWidth: '480px' }}>
          거시경제와 시장의 흐름을 누구나 접근하기 쉽게.
        </p>
      </section>

      {/* ── INDICATORS ── */}
      <section style={{ maxWidth: '720px', margin: '0 auto', padding: '0 48px 160px' }}>

        <p style={{
          fontSize: '20px',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: '#000000',
          marginBottom: '48px',
          borderTop: '1px solid #e8e8e8',
          paddingTop: '64px',
        }}>
          Indicators
        </p>

        {indicators.map((item) => (
          <div
            key={item.num}
            onClick={() => navigate(item.path)}
            style={{
              padding: '40px 0',
              borderBottom: '1px solid #e8e8e8',
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.4')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', color: '#000000', minWidth: '24px' }}>
                {item.num}
              </span>
              <div>
                <p style={{ fontSize: '24px', fontWeight: '400', color: '#000000', marginBottom: '6px' }}>
                  {item.title}
                </p>
              </div>
            </div>
            <p style={{ fontSize: '15px', lineHeight: '1.75', color: '#000000', paddingLeft: '44px', textAlign: 'justify', wordBreak: 'keep-all'}}>
              {item.desc}
            </p>
          </div>
        ))}
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid #e8e8e8', padding: '32px 48px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#000000' }}>
        <span>Anthracite © 2026</span>
      </footer>

    </div>
  )
}