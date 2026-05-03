import { useNavigate } from 'react-router-dom'

const sections = [
  {
    title: 'FOMC',
    subtitle: '연방공개시장위원회',
    desc: 'FOMC는 미국의 통화정책을 결정하는 핵심 기구로, 연간 8회의 정례 회의를 통해 정책 방향을 설정합니다. 단순히 금리를 결정하는 것을 넘어, 경제 전망에 대한 판단과 향후 정책 경로에 대한 신호를 시장에 제공합니다. 특히 성명서, 점도표, 기자회견을 통해 정책 의도를 전달하며, 시장은 이를 바탕으로 금리와 유동성의 향후 흐름을 반영합니다.',
    links: [
      { url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm', label: 'Fed — FOMC 캘린더에서 보기 ↗' },
    ],
    linkDesc: null,
    link: null,
  },
  {
    title: 'Interest Rate Policy',
    subtitle: '금리 정책',
    desc: '정책금리(Fed Funds Rate)는 은행 간 초단기 자금 거래에 적용되는 기준 금리로, 금융 시스템 전반의 금리 구조를 형성하는 출발점입니다. FOMC는 인플레이션, 고용, 경제 성장 등 주요 거시지표를 바탕으로 금리 수준을 결정하며, 이는 경기 과열 억제 또는 경기 부양을 위한 핵심 수단으로 작용합니다. 금리 인상은 자금 조달 비용을 높여 수요를 억제하고, 금리 인하는 유동성을 확대해 투자와 소비를 자극하는 방향으로 작용합니다.',
    linkDesc: '시장은 현재 금리 수준뿐만 아니라, 향후 금리 경로에 대한 기대를 자산 가격에 반영합니다. 이러한 기대는 CME FedWatch Tool을 통해 확인할 수 있으며, 선물 시장 데이터를 기반으로 다음 FOMC 회의에서의 금리 변동 확률을 제공합니다.',
    links: [
      { url: 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html', label: 'CME FedWatch Tool에서 보기 ↗' },
    ],
    link: null,
  },
  {
    title: 'Policy Tools',
    subtitle: '통화정책 수단',
    desc: '중앙은행은 정책금리를 실제 시장에 전달하기 위해 다양한 수단을 활용합니다. 공개시장조작은 국채 매입·매도를 통해 시중 유동성을 직접 조절하는 핵심 수단이며, 재할인율 정책은 은행이 중앙은행으로부터 자금을 빌릴 때 적용되는 금리로 금융 시스템의 안전판 역할을 합니다. 특히 양적완화는 중앙은행이 국채·MBS 등 자산을 대규모로 매입해 시중에 유동성을 직접 공급하는 수단으로, 금리가 이미 0에 근접했을 때 활용됩니다. 반대로 양적긴축은 보유 자산을 축소해 시중 유동성을 흡수하는 과정으로, 현대 통화정책에서 금리 조정과 함께 가장 중요한 정책 수단 중 하나입니다. 이러한 도구들은 함께 작동하며 금리 수준과 자금 흐름을 시장 전반에 전달합니다.',
    links: [],
    linkDesc: null,
    link: null,
  },
]

export default function Fed() {
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
            Fed & Monetary Policy
          </h1>
          <p className="page-desc" style={{ fontSize: '18px', lineHeight: '1.85', color: '#444', maxWidth: '640px', textAlign: 'justify', wordBreak: 'keep-all' }}>
            FOMC는 연간 8회의 회의를 통해 정책금리를 결정하며, 경기 둔화·부양과 인플레이션 억제 등 경제 상황에 따라 통화정책 방향을 조정합니다. 중앙은행은 공개시장조작, 양적완화(QE), 양적긴축(QT) 등 다양한 수단을 통해 유동성을 조절하며, 이를 통해 금리 수준과 시장의 유동성 환경이 결정됩니다.
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
                  <p style={{ fontSize: '16px', lineHeight: '1.85', color: '#444', marginBottom: item.links.length > 0 || item.linkDesc ? '24px' : '0', textAlign: 'justify', wordBreak: 'keep-all' }}>
                    {item.desc}
                  </p>
                  {item.linkDesc && (
                    <p style={{ fontSize: '16px', lineHeight: '1.85', color: '#444', marginBottom: '28px', textAlign: 'justify', wordBreak: 'keep-all' }}>
                      {item.linkDesc}
                    </p>
                  )}
                  {item.links.length > 0 && (
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
                  )}
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