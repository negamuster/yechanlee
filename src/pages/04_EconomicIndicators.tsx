import { useNavigate } from 'react-router-dom'

const sections = [
  {
    title: 'Economic Growth',
    subtitle: '경제 성장',
    desc: 'GDP(국내총생산)는 일정 기간 동안 한 국가에서 생산된 모든 재화와 서비스의 시장 가치를 합산한 지표로, 경제 규모와 성장 속도를 측정하는 가장 대표적인 척도입니다. GDP 성장률은 경기 확장과 수축을 판단하는 기준이 되며, 두 분기 연속 마이너스 성장은 기술적 경기침체로 정의됩니다. 데이터를 볼 때는 절대 수치보다 전분기 대비 성장률의 방향과 속도에 주목하는 것이 중요하며, 시장 예상치 대비 상회 혹은 하회 여부가 자산 가격에 즉각적인 영향을 미칩니다.',
    links: [
      { url: 'https://www.bea.gov/data/gdp/gross-domestic-product', label: 'BEA — GDP에서 보기 ↗' },
      { url: 'https://fred.stlouisfed.org/series/GDP', label: 'FRED — GDP에서 보기 ↗' },
    ],
  },
  {
    title: 'Inflation',
    subtitle: '물가',
    desc: '인플레이션은 전반적인 물가 수준의 지속적인 상승을 의미하며, 소비자물가지수(CPI)와 생산자물가지수(PPI)를 통해 측정됩니다. CPI는 소비자가 실제로 체감하는 물가 변화를, PPI는 생산 단계에서의 가격 변화를 반영하며 향후 CPI의 선행 신호로 활용됩니다. 근원 CPI(Core CPI)와 근원 PCE(Core PCE)는 변동성이 큰 에너지·식품을 제외한 지표로, 특히 Core PCE는 Fed가 통화정책 결정 시 가장 중요하게 참고하는 물가 지표입니다. 물가 데이터를 볼 때는 헤드라인 수치와 함께 근원 지표의 방향성을 함께 확인하며, 시장 예상치 대비 얼마나 벗어났는지를 중심으로 해석하는 것이 중요합니다.',
    links: [
      { url: 'https://www.bls.gov/cpi/', label: 'BLS — CPI에서 보기 ↗' },
      { url: 'https://www.bls.gov/ppi/', label: 'BLS — PPI에서 보기 ↗' },
      { url: 'https://fred.stlouisfed.org/series/PCEPILFE', label: 'FRED — Core PCE에서 보기 ↗' },
    ],
  },
  {
    title: 'Labor Market',
    subtitle: '고용',
    desc: '고용 시장은 경제의 건강 상태를 보여주는 핵심 지표 중 하나입니다. 실업률(Unemployment Rate)은 경제활동인구 중 일자리를 찾고 있는 비율을 나타내며, 비농업 고용지수(NFP, Nonfarm Payrolls)는 농업을 제외한 전 산업에서 한 달간 새로 창출된 일자리 수를 보여줍니다. 고용 데이터는 후행지표적 성격을 가지지만, NFP는 매월 첫째 주 금요일에 발표되며 시장에서 가장 주목하는 경제지표 중 하나입니다. 숫자 자체보다 시장 예상치 대비 결과와 전월 수치의 수정 여부를 함께 확인하는 것이 중요합니다.',
    links: [
      { url: 'https://fred.stlouisfed.org/series/UNRATE', label: 'FRED — 실업률에서 보기 ↗' },
      { url: 'https://www.investing.com/economic-calendar/nonfarm-payrolls-227', label: 'Investing.com — NFP에서 보기 ↗' },
    ],
  },
  {
    title: 'Leading Indicators',
    subtitle: '선행지표',
    desc: '선행지표는 경기 방향의 변화를 실제 데이터보다 앞서 신호하는 지표들로, 향후 경기 흐름을 예측하는 데 활용됩니다. ISM 제조업 지수는 구매관리자들의 설문을 바탕으로 산출되며, 50 이상이면 제조업 확장, 50 미만이면 수축을 의미합니다. 경기선행지수(LEI, Leading Economic Index)는 10개의 선행지표를 종합한 복합지수로, 수개월 후의 경기 방향성을 가늠하는 데 사용됩니다. 선행지표를 볼 때는 단일 수치보다 연속적인 방향 변화에 주목하며, 여러 선행지표가 동시에 같은 방향을 가리킬 때 신뢰도가 높아집니다.',
    links: [
      { url: 'https://www.ismworld.org/supply-management-news-and-reports/reports/ism-report-on-business/', label: 'ISM — Manufacturing Index에서 보기 ↗' },
      { url: 'https://fred.stlouisfed.org/graph/?g=4Bz8', label: 'FRED — Leading Economic Index에서 보기 ↗' },
    ],
  },
]

export default function EconomicIndicators() {
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
            Economic Indicators
          </h1>
          <p className="page-desc" style={{ fontSize: '18px', lineHeight: '1.85', color: '#444', maxWidth: '640px', textAlign: 'justify', wordBreak: 'keep-all' }}>
            경제지표는 경제의 현재 상태와 앞으로의 방향성을 수치로 보여주는 데이터입니다. 경제 성장, 물가, 고용, 선행지표를 함께 살펴보면 현재 경기가 어느 국면에 있는지, 그리고 중앙은행과 시장이 어떤 방향으로 움직일지를 보다 입체적으로 파악할 수 있습니다.
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