import { useNavigate } from 'react-router-dom'

const indicators = [
  {
    num: '01',
    title: 'Equity Markets',
    subtitle: 'Global Stock Markets',
    desc: '글로벌 주식시장의 지수를 통해 시장의 전반적인 흐름과 구조를 한눈에 파악합니다.',
    path: '/equity',
  },
  {
    num: '02',
    title: 'Fed & Monetary Policy',
    subtitle: 'FOMC & 통화정책',
    desc: 'FOMC의 정책 결정을 중심으로 중앙은행이 금리와 유동성 조절을 통해 통화정책을 운용하는 방식과 그 영향이 시장에 어떻게 영향을 미치는지 구조적으로 살펴봅니다.',
    path: '/rates',
  },
  {
    num: '03',
    title: 'US Treasury & Yield Curve',
    subtitle: '국채 수익률 곡선 & 채권시장',
    desc: '단기-장기 국채 금리의 관계를 나타내는 수익률 곡선은 경기침체를 예고하는 가장 신뢰도 높은 선행지표 중 하나입니다. 역전과 정상화의 의미를 짚어봅니다.',
    path: '/treasury',
  },
  {
    num: '04',
    title: 'FRED Indicators',
    subtitle: '미국 연방준비은행 경제 데이터',
    desc: 'FRED(Federal Reserve Economic Data)에서 제공하는 핵심 경제지표들을 소개합니다. 실업률, 인플레이션, 소비지출 등 경제의 체온을 측정하는 데이터를 다룹니다.',
    path: '/fred',
  },
  {
    num: '05',
    title: 'FX, Commodities & Business Cycle',
    subtitle: '환율, 원자재 & 경기사이클',
    desc: '달러 인덱스(DXY), 금·은·유가 등 원자재, 그리고 PMI·LEI 같은 경기선행지표를 통해 글로벌 매크로 흐름의 큰 그림을 그려봅니다.',
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
                <p style={{ fontSize: '13px', color: '#000000', letterSpacing: '0.02em' }}>
                  {item.subtitle}
                </p>
              </div>
            </div>
            <p style={{ fontSize: '15px', lineHeight: '1.75', color: '#000000', paddingLeft: '44px' }}>
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