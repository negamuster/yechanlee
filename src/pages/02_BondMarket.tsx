import { useNavigate } from 'react-router-dom'

const sections = [
  {
    title: 'Key Rates',
    subtitle: '주요 금리',
    desc: '채권 시장의 핵심은 다양한 만기의 국채 금리입니다. 단기 금리는 중앙은행의 정책금리에 민감하게 반응하는 반면, 장기 금리는 인플레이션 기대와 경제 성장 전망을 반영합니다. 특히 2년물과 10년물 국채 금리는 시장에서 가장 널리 사용되는 기준 지표로, 두 금리의 차이는 경기 국면을 판단하는 데 중요한 신호로 활용됩니다. 데이터를 볼 때는 단기 금리(정책 기대)와 장기 금리(성장·인플레이션 기대)가 각각 어떻게 움직이는지를 함께 확인하는 것이 중요하며, 두 금리가 같은 방향으로 움직이는지, 혹은 반대로 벌어지거나 좁혀지는지에 주목하면 시장이 현재 경기 국면을 어떻게 바라보는지를 파악할 수 있습니다.',
    links: [
      { url: 'https://fred.stlouisfed.org/series/DGS10', label: 'FRED — 10Y Treasury Yield에서 보기 ↗' },
    ],
  },
  {
    title: 'Yield Curve',
    subtitle: '수익률 곡선',
    desc: '수익률 곡선은 만기가 다른 국채 금리를 연결한 곡선으로, 시장이 예상하는 금리 구조와 경기 방향을 보여주는 대표적인 선행지표입니다. 일반적으로는 장기 금리가 단기 금리보다 높은 우상향 형태를 보이지만, 단기 금리가 장기 금리를 초과하는 역전 상태는 경기 둔화 또는 침체 가능성을 시사하는 신호로 해석됩니다. 수익률 곡선을 볼 때는 곡선의 기울기 변화에 집중하는 것이 중요합니다. 곡선이 가팔라지면 경기 회복 기대가 반영된 것으로, 평탄화되면 성장 둔화 우려가 커지는 것으로 해석됩니다. 특히 역전 이후 곡선이 다시 가팔라지는 구간은 실제 경기침체와 더 밀접하게 연관되는 경우가 많아 주의 깊게 살펴볼 필요가 있습니다.',
    links: [
      { url: 'https://www.ustreasuryyieldcurve.com/', label: 'US Treasury Yield Curve에서 보기 ↗' },
    ],
  },
  {
    title: 'Credit Spreads',
    subtitle: '신용 스프레드',
    desc: '신용 스프레드는 회사채 금리와 국채 금리의 차이로, 시장이 인식하는 신용 위험과 투자 심리를 반영합니다. 일반적으로 경기 상황이 안정적일 때는 스프레드가 축소되며, 불확실성이 커질수록 투자자들이 안전자산을 선호하면서 스프레드가 확대됩니다. 투자등급 스프레드와 고수익(High Yield) 스프레드를 함께 보면 리스크 온/오프 환경을 더 입체적으로 파악할 수 있습니다. 스프레드가 빠르게 확대되고 있다면 시장이 위험을 회피하고 있다는 신호로, 점진적으로 축소되고 있다면 위험 선호 환경으로 전환되고 있음을 의미합니다.',
    links: [
      { url: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2', label: 'FRED — High Yield Spread에서 보기 ↗' },
      { url: 'https://fred.stlouisfed.org/series/BAMLC0A0CM', label: 'FRED — Investment Grade Spread에서 보기 ↗' },
    ],
  },
  {
    title: 'Real Interest Rate',
    subtitle: '실질 금리',
    desc: '실질 금리는 명목 금리에서 기대 인플레이션을 차감한 값으로, 자산의 실제 구매력 기준 수익률을 나타냅니다. 이는 단순한 금리 수준보다 더 중요한 지표로, 투자 환경과 자산 가격에 직접적인 영향을 미칩니다. 일반적으로 실질 금리가 상승하면 자금 조달 부담이 커지면서 주식 등 위험자산에 부담이 되고, 하락하면 유동성이 확대되며 자산 가격에 긍정적으로 작용합니다. 실질 금리의 절대 수준보다 방향성에 주목하는 것이 중요하며, 오르는 구간에서는 긴축 환경, 내려가는 구간에서는 완화 환경으로 판단해 자산 배분의 기준으로 활용할 수 있습니다.',
    links: [
      { url: 'https://fred.stlouisfed.org/series/DFII10', label: 'FRED — 10Y TIPS에서 보기 ↗' },
    ],
  },
]

export default function BondMarket() {
  const navigate = useNavigate()

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .page-title { opacity: 0; animation: slideUp 0.7s ease forwards 0.1s; }
        .page-desc  { opacity: 0; animation: slideUp 0.7s ease forwards 0.3s; }
        .page-section { opacity: 0; animation: slideUp 0.7s ease forwards 0.5s; }
      `}</style>

      <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: '"Times New Roman", Times, serif', color: '#000000' }}>

        <nav style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8e8e8' }}>
          <span onClick={() => navigate('/')} style={{ fontSize: '22px', fontWeight: '600', cursor: 'pointer' }}>Anthracite</span>
        </nav>

        <section style={{ maxWidth: '860px', margin: '0 auto', padding: '80px 48px 64px' }}>
          <h1 className="page-title" style={{ fontSize: '52px', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '28px', lineHeight: '1.1' }}>
            Rates & Bond Market
          </h1>
          <p className="page-desc" style={{ fontSize: '18px', lineHeight: '1.85', color: '#444', maxWidth: '640px', textAlign: 'justify', wordBreak: 'keep-all' }}>
            채권 시장은 정부와 기업이 대규모 자금을 조달하기 위해 발행한 채권이 거래되는 시장으로, 글로벌 금융 시스템에서 가장 큰 규모를 차지하는 핵심 시장입니다. 투자자는 채권을 통해 일정한 이자 수익을 얻으며, 채권 가격은 금리 변화에 따라 움직여 두 요소는 반대로 움직이는 특징을 가집니다. 특히 국채 금리는 통화정책, 인플레이션 기대, 경제 성장 전망 등을 미리 반영하며 전체 금융 시장의 자산 가격에 중요한 기준을 제공합니다. 따라서 채권 시장은 향후 경기 방향성과 정책 경로에 대한 시장의 기대를 가장 빠르게 반영하는 핵심 지표로 작용합니다.
          </p>
        </section>

        <section className="page-section" style={{ maxWidth: '860px', margin: '0 auto', padding: '0 48px 160px' }}>
          <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '64px' }}>
            {sections.map((item) => (
              <div key={item.title} style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '48px', padding: '56px 0', borderBottom: '1px solid #e8e8e8', alignItems: 'start' }}>
                <div>
                  <p style={{ fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: '12px' }}>{item.subtitle}</p>
                  <h2 style={{ fontSize: '36px', fontWeight: '400', letterSpacing: '-0.01em', lineHeight: '1.1', color: '#000' }}>{item.title}</h2>
                </div>
                <div>
                  <p style={{ fontSize: '16px', lineHeight: '1.85', color: '#444', marginBottom: '28px', textAlign: 'justify', wordBreak: 'keep-all' }}>{item.desc}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {item.links.map((link) => (
                      <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                        <div
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#000', borderBottom: '1px solid #000', paddingBottom: '2px', cursor: 'pointer', transition: 'opacity 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.4')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                        >
                          {link.label}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer style={{ borderTop: '1px solid #e8e8e8', padding: '32px 48px', fontSize: '12px', color: '#aaa' }}>
          <span>Anthracite © 2026</span>
        </footer>

      </div>
    </>
  )
}