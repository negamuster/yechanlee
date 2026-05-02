import { useNavigate } from 'react-router-dom'

const sections = [
  {
    title: 'Exchange Rate',
    subtitle: '환율',
    desc: '환율은 두 통화 간의 교환 비율로, 글로벌 자금 흐름과 경제 상황을 반영하는 핵심 지표입니다. 그중에서도 달러 인덱스(DXY)는 유로, 엔, 파운드 등 주요 6개 통화 대비 달러의 상대적 강도를 나타내며, 글로벌 금융 시장의 방향성을 읽는 데 중요한 기준이 됩니다. 달러가 강세를 보이면 글로벌 유동성이 위축되고 신흥국 자산과 원자재 가격에 하방 압력이 가해지는 반면, 달러 약세는 글로벌 자금이 위험자산으로 이동하는 환경을 만드는 경향이 있습니다. 달러 인덱스의 방향과 함께 주요 통화쌍(EUR/USD, USD/JPY 등)의 움직임을 함께 살펴보면 글로벌 자금 흐름의 큰 그림을 파악하는 데 도움이 됩니다.',
    links: [
      { url: 'https://finance.yahoo.com/quote/DX-Y.NYB/', label: 'Yahoo Finance — Dollar Index (DXY) ↗' },
      { url: 'https://finance.yahoo.com/markets/currencies/', label: 'Yahoo Finance — Currencies ↗' },
      { url: 'https://www.tradingview.com/markets/currencies/', label: 'TradingView — Currencies ↗' },
    ],
  },
  {
    title: 'Commodities',
    subtitle: '원자재',
    desc: '원자재 시장은 실물 경제의 수요·공급 상황과 인플레이션 기대를 직접적으로 반영합니다. 금(Gold)은 대표적인 안전자산으로, 인플레이션 헤지 수단이자 달러 약세 및 지정학적 불안 시 강세를 보이는 경향이 있습니다. 은(Silver)은 금과 유사한 성격을 가지면서도 산업 수요의 영향을 함께 받아 경기 민감도가 더 높습니다. 원유(Oil)는 글로벌 경제 활동의 수준을 가장 직접적으로 반영하는 원자재로, 유가 상승은 인플레이션 압력을 높이고 기업 비용 부담을 키우는 방향으로 작용합니다. 원자재 가격의 방향성을 통해 현재 시장이 경기 회복을 기대하는지, 혹은 위축을 우려하는지를 파악할 수 있습니다.',
    links: [
      { url: 'https://finance.yahoo.com/markets/commodities/', label: 'Yahoo Finance — Commodities ↗' },
      { url: 'https://www.investing.com/commodities', label: 'Investing.com — Commodities ↗' },
    ],
  },
  {
    title: 'Market Sentiment',
    subtitle: '시장 심리',
    desc: '시장 심리 지표는 투자자들의 집단적인 감정과 리스크 인식 수준을 수치화한 지표로, 시장의 과열과 공포 국면을 파악하는 데 활용됩니다. VIX 지수는 S&P 500 옵션 시장에서 도출된 향후 30일 기대 변동성으로, 공포지수(Fear Index)라고도 불립니다. VIX가 상승하면 투자자들이 리스크를 회피하며 안전자산으로 이동하는 신호로, 하락하면 시장이 안정적이고 위험 선호 심리가 강해지는 환경으로 해석됩니다. Fear & Greed Index는 CNN이 산출하는 복합 심리 지표로, 0에 가까울수록 극단적 공포, 100에 가까울수록 극단적 탐욕을 나타냅니다. 이 지표들은 단독으로 매매 신호로 사용하기보다, 현재 시장의 심리적 온도를 파악하고 다른 거시 지표와 함께 교차 분석하는 용도로 활용하는 것이 효과적입니다.',
    links: [
      { url: 'https://finance.yahoo.com/quote/%5EVIX/', label: 'Yahoo Finance — VIX ↗' },
      { url: 'https://edition.cnn.com/markets/fear-and-greed', label: 'CNN — Fear & Greed Index ↗' },
    ],
  },
]

export default function GlobalMacro() {
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
          <span onClick={() => navigate('/')} style={{ fontSize: '20px', fontWeight: '600', cursor: 'pointer' }}>Anthracite</span>
        </nav>

        <section style={{ maxWidth: '860px', margin: '0 auto', padding: '80px 48px 64px' }}>
          <h1 className="page-title" style={{ fontSize: '52px', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '28px', lineHeight: '1.1' }}>
            Global Macro
          </h1>
          <p className="page-desc" style={{ fontSize: '18px', lineHeight: '1.85', color: '#444', maxWidth: '640px', textAlign: 'justify', wordBreak: 'keep-all' }}>
            글로벌 매크로는 환율, 원자재, 시장 심리 등 국경을 초월한 거시 변수들의 상호작용을 분석하는 관점입니다. 개별 자산이나 국가 경제에 국한되지 않고, 글로벌 자금 흐름과 리스크 온·오프 환경의 변화를 파악함으로써 시장 전반의 방향성을 보다 입체적으로 이해할 수 있습니다.
          </p>
        </section>

        <section className="page-section" style={{ maxWidth: '860px', margin: '0 auto', padding: '0 48px 160px' }}>
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
                <div>
                  <p style={{ fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: '12px' }}>
                    {item.subtitle}
                  </p>
                  <h2 style={{ fontSize: '36px', fontWeight: '400', letterSpacing: '-0.01em', lineHeight: '1.1', color: '#000' }}>
                    {item.title}
                  </h2>
                </div>
                <div>
                  <p style={{ fontSize: '16px', lineHeight: '1.85', color: '#444', marginBottom: '28px', textAlign: 'justify', wordBreak: 'keep-all' }}>
                    {item.desc}
                  </p>
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

      </div>
    </>
  )
}