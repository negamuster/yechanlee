import { useNavigate } from 'react-router-dom'

const sections = [
  {
    title: 'FOMC',
    subtitle: '연방공개시장위원회',
    desc: 'FOMC는 미국의 통화정책을 결정하는 핵심 기구로, 연간 8회의 정례 회의를 통해 정책 방향을 설정합니다. 단순히 금리를 결정하는 것을 넘어, 경제 전망에 대한 판단과 향후 정책 경로에 대한 신호를 시장에 제공합니다. 특히 성명서(Statement), 점도표(Dot Plot), 기자회견을 통해 정책 의도를 전달하며, 시장은 이를 바탕으로 금리와 유동성의 향후 흐름을 반영합니다.',
    link: null,
  },
  {
    title: 'Interest Rate Policy',
    subtitle: '금리 정책',
    desc: '정책금리(Fed Funds Rate)는 은행 간 초단기 자금 거래에 적용되는 기준 금리로, 금융 시스템 전반의 금리 구조를 형성하는 출발점입니다. FOMC는 인플레이션, 고용, 경제 성장 등 주요 거시지표를 바탕으로 금리 수준을 결정하며, 이는 경기 과열 억제 또는 경기 부양을 위한 핵심 수단으로 작용합니다. 금리 인상은 자금 조달 비용을 높여 수요를 억제하고, 금리 인하는 유동성을 확대해 투자와 소비를 자극하는 방향으로 작용합니다.',
    linkDesc: '시장은 현재 금리 수준뿐만 아니라, 향후 금리 경로에 대한 기대를 자산 가격에 반영합니다. 이러한 기대는 CME FedWatch Tool을 통해 확인할 수 있으며, 선물 시장 데이터를 기반으로 다음 FOMC 회의에서의 금리 변동 확률을 제공합니다.',
    link: {
      url: 'https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html',
      label: 'CME FedWatch Tool에서 보기 ↗',
    },
  },
  {
    title: 'Policy Tools',
    subtitle: '통화정책 수단',
    desc: '중앙은행은 정책금리를 실제 시장에 전달하기 위해 다양한 수단을 활용합니다. 공개시장조작은 국채 매입·매도를 통해 시중 유동성을 직접 조절하는 핵심 수단이며, 재할인율 정책은 은행이 중앙은행으로부터 자금을 빌릴 때 적용되는 금리로 금융 시스템의 안전판 역할을 합니다. 지급준비율(Reserve Requirement)은 은행의 대출 가능 규모를 제한함으로써 신용 창출을 조절하는 수단입니다. 이러한 도구들은 함께 작동하며 금리 수준과 자금 흐름을 시장 전반에 전달합니다.',
    link: null,
  },
]

export default function Rates() {
  const navigate = useNavigate()

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: '"Times New Roman", Times, serif', color: '#000000' }}>

      {/* ── NAV ── */}
      <nav style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8e8e8' }}>
        <span onClick={() => navigate('/')} style={{ fontSize: '20px', fontWeight: '600', cursor: 'pointer' }}>Anthracite</span>
        <span style={{ fontSize: '14px', color: '#aaa' }}>02 — Fed & Monetary Policy</span>
      </nav>

      {/* ── HEADER ── */}
      <section style={{ maxWidth: '860px', margin: '0 auto', padding: '80px 48px 64px' }}>
        <p style={{ fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '24px' }}>
          02
        </p>
        <h1 style={{ fontSize: '52px', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '28px', lineHeight: '1.1' }}>
          Fed & Monetary Policy
        </h1>
        <p style={{ fontSize: '18px', lineHeight: '1.85', color: '#444', maxWidth: '640px', textAlign: 'justify', wordBreak: 'keep-all' }}>
          FOMC는 연간 8회의 회의를 통해 정책금리를 결정하며, 경기 둔화·부양과 인플레이션 억제 등 경제 상황에 따라 통화정책 방향을 조정합니다. 중앙은행은 공개시장조작(Open Market Operations)과 재할인율 정책(Discount Rate Policy) 등을 통해 유동성을 조절하며, 이를 통해 시장 전반에 영향을 미칩니다.
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
                <h2 style={{ fontSize: '32px', fontWeight: '400', letterSpacing: '-0.01em', lineHeight: '1.1', color: '#000' }}>
                  {item.title}
                </h2>
              </div>

              {/* 오른쪽: 설명 + 링크 */}
              <div>
                <p style={{ fontSize: '16px', lineHeight: '1.85', color: '#444', marginBottom: item.link ? '24px' : '0', textAlign: 'justify', wordBreak: 'keep-all' }}>
                  {item.desc}
                </p>

                {item.link && (
                  <>
                    <p style={{ fontSize: '16px', lineHeight: '1.85', color: '#444', marginBottom: '28px', textAlign: 'justify', wordBreak: 'keep-all' }}>
                      {item.linkDesc}
                    </p>
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
                  </>
                )}
              </div>
            </div>
          ))}

        </div>
      </section>

    </div>
  )
}