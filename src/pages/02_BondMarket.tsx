import { useNavigate } from 'react-router-dom'

const sections = [
  {
    title: 'Key Rates',
    subtitle: '주요 금리',
    desc: '채권 시장의 핵심은 다양한 만기의 국채 금리입니다. 단기금리는 중앙은행의 정책금리에 민감하게 반응하며, 장기금리는 인플레이션 기대와 경제 성장 전망을 반영합니다. 특히 2년물과 10년물 국채 금리는 시장에서 가장 주목받는 지표로, 두 금리의 차이(스프레드)는 경기 국면을 판단하는 데 중요한 신호를 제공합니다.',
    link: {
      url: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value_month=202504',
      label: 'US Treasury에서 보기 ↗',
    },
    linkDesc: null,
  },
  {
    title: 'Yield Curve',
    subtitle: '수익률 곡선',
    desc: '수익률 곡선(Yield Curve)은 만기가 다른 국채들의 금리를 연결한 곡선으로, 경기 방향성을 예측하는 가장 신뢰도 높은 선행지표 중 하나입니다. 정상적인 상황에서는 장기금리가 단기금리보다 높아 우상향 곡선을 그리지만, 단기금리가 장기금리를 초과하는 역전(Inversion) 상태는 역사적으로 경기침체를 예고하는 신호로 해석됩니다.',
    link: {
      url: 'https://fred.stlouisfed.org/series/T10Y2Y',
      label: 'FRED — 2s10s Spread에서 보기 ↗',
    },
    linkDesc: null,
  },
  {
    title: 'Credit Spreads',
    subtitle: '신용 스프레드',
    desc: '신용 스프레드는 회사채 금리와 국채 금리의 차이로, 시장의 신용 리스크와 투자 심리를 반영합니다. 스프레드가 확대되면 기업의 자금 조달 비용이 높아지고 시장의 위험 회피 성향이 강해졌음을 의미하며, 스프레드가 축소되면 경기 회복 기대와 위험 선호 심리가 반영된 것으로 해석됩니다.',
    link: {
      url: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2',
      label: 'FRED — High Yield Spread에서 보기 ↗',
    },
    linkDesc: null,
  },
  {
    title: 'Real Yields',
    subtitle: '실질 금리',
    desc: '실질 금리는 명목 금리에서 기대 인플레이션을 차감한 값으로, 자산 가격과 경제 활동에 미치는 실질적인 금융 환경을 나타냅니다. 실질 금리가 상승하면 자금 조달 비용이 실질적으로 높아져 성장주와 위험자산에 부담이 되며, 하락하면 반대로 유동성 환경이 완화되는 신호로 해석됩니다.',
    link: {
      url: 'https://fred.stlouisfed.org/series/DFII10',
      label: 'FRED — 10Y TIPS에서 보기 ↗',
    },
    linkDesc: null,
  },
]

export default function BondMarket() {
  const navigate = useNavigate()

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: '"Times New Roman", Times, serif', color: '#000000' }}>

      {/* ── NAV ── */}
      <nav style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8e8e8' }}>
        <span onClick={() => navigate('/')} style={{ fontSize: '20px', fontWeight: '600', cursor: 'pointer' }}>Anthracite</span>
      </nav>

      {/* ── HEADER ── */}
      <section style={{ maxWidth: '860px', margin: '0 auto', padding: '80px 48px 64px' }}>
        <h1 style={{ fontSize: '52px', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '28px', lineHeight: '1.1' }}>
          Rates & Bond Market
        </h1>
        <p style={{ fontSize: '18px', lineHeight: '1.85', color: '#444', maxWidth: '640px', textAlign: 'justify', wordBreak: 'keep-all' }}>
          채권 시장은 정부와 기업이 대규모 자금을 조달하기 위해 발행한 채권이 거래되는 시장으로, 글로벌 금융 시스템에서 가장 큰 규모를 차지하는 핵심 시장입니다. 투자자는 채권을 통해 일정한 이자 수익을 얻으며, 채권 가격은 금리 변화에 따라 움직여 두 요소는 반대로 움직이는 특징을 가집니다. 특히 국채 금리는 이러한 채권 시장에서 형성되는 기준 금리로, 통화정책, 인플레이션 기대, 경제 성장 전망 등을 미리 반영하며 전체 금융 시장의 자산 가격에 중요한 기준을 제공합니다. 따라서 채권 시장은 단순한 자금 조달처를 넘어, 향후 경기 방향성과 정책 경로에 대한 시장의 기대를 가장 빠르게 반영하는 핵심 지표로 작용합니다.
        </p>
      </section>

      {/* ── SECTIONS ── */}
      <section style={{ maxWidth: '860px', margin: '0 auto', padding: '0 48px 160px' }}>
        <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '64px' }}>

          {sections.map((item) => (
            <div
              key={item.title}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.6fr',
                gap: '48px',
                padding: '56px 0',
                borderBottom: '1px solid #e8e8e8',
                alignItems: 'start',
              }}
            >
              {/* 왼쪽: 제목 */}
              <div>
                <p style={{ fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: '12px' }}>
                  {item.subtitle}
                </p>
                <h2 style={{ fontSize: '36px', fontWeight: '400', letterSpacing: '-0.01em', lineHeight: '1.1', color: '#000' }}>
                  {item.title}
                </h2>
              </div>

              {/* 오른쪽: 설명 + 링크 */}
              <div>
                <p style={{ fontSize: '16px', lineHeight: '1.85', color: '#444', marginBottom: '28px', textAlign: 'justify', wordBreak: 'keep-all' }}>
                  {item.desc}
                </p>
                {item.link && (
                  <a
                    href={item.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        color: '#000',
                        borderBottom: '1px solid #000',
                        paddingBottom: '2px',
                        cursor: 'pointer',
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.4')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      {item.link.label}
                    </div>
                  </a>
                )}
              </div>
            </div>
          ))}

        </div>
      </section>

    </div>
  )
}