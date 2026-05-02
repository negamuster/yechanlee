import { useNavigate } from 'react-router-dom'

const indices = [
  {
    name: 'S&P 500',
    region: 'United States',
    desc: '미국 주요 거래소에 상장된 500개 대형 기업의 주가를 추종하는 대표적인 주가지수입니다. 미국 상장 기업 전체 시가총액의 약 80%를 포함하며, 가장 널리 사용되는 글로벌 주식시장 기준 지수 중 하나입니다. 미국 경제 전반의 흐름과 시장의 전반적인 방향성을 파악하는 데 핵심적인 역할을 합니다.',
    url: 'https://finance.yahoo.com/quote/%5EGSPC/',
  },
  {
    name: 'Nasdaq 100',
    region: 'United States',
    desc: '나스닥에 상장된 비금융 대형 기업 100개로 구성된 지수로, 시가총액 가중 방식(일부 상한 적용)을 사용합니다. NVIDIA, Alphabet (Google), Apple, Microsoft, Amazon 등 빅테크 기업의 비중이 높아 기술주 중심의 성장주 흐름을 대표하며, 금리 변화에 민감하게 반응하는 특징을 가지고 있어 시장의 성장 기대와 투자 심리를 파악하는 데 핵심적인 지표입니다.',
    url: 'https://finance.yahoo.com/quote/%5EIXIC/',
  },
  {
    name: 'FTSE 100',
    region: 'United Kingdom',
    desc: '런던증권거래소에 상장된 시가총액 상위 100개 기업으로 구성된 영국의 대표 주가지수입니다. 글로벌 사업을 영위하는 대형 기업의 비중이 높아, 단순한 영국 경제뿐 아니라 국제경제 환경의 영향을 함께 반영합니다. 유럽 시장과 글로벌 경기 흐름을 파악하는 데 활용됩니다.',
    url: 'https://finance.yahoo.com/quote/%5EFTSE/',
  },
  {
    name: 'KOSPI',
    region: 'South Korea',
    desc: '한국거래소 유가증권시장에 상장된 모든 보통주를 대상으로 산출되는 지수로, 한국 주식시장을 대표합니다. 미국의 S&P 500과 유사한 역할을 하며, 국내 경제뿐 아니라 수출 중심 산업 구조를 반영합니다. 글로벌 경기 변화에 민감하게 반응하는 특징을 가집니다.',
    url: 'https://finance.yahoo.com/quote/%5EKS11/',
  },
  {
    name: 'Nikkei 225',
    region: 'Japan',
    desc: '도쿄증권거래소에 상장된 225개 대표 기업으로 구성된 일본의 주요 주가지수로, 가격가중 방식으로 산출됩니다. 다양한 산업을 포함하고 있지만 수출 기업 비중이 높아 엔화 환율과 역의 상관관계를 보이는 경우가 많으며, 일본은행(BOJ)의 통화정책 변화에 민감하게 반응하여 일본 경제와 글로벌 제조업 흐름을 파악하는 데 중요한 지표입니다.',
    url: 'https://finance.yahoo.com/quote/%5EN225/',
  },
  {
    name: 'Hang Seng',
    region: 'Hong Kong',
    desc: '홍콩증권거래소에 상장된 주요 대형 기업들로 구성된 시가총액 가중 지수로, 유동주식 비율이 반영됩니다. 홍콩 시장 전체 시가총액의 상당 부분을 차지하는 기업들로 구성되어 있으며, 시장 전반의 움직임을 대표합니다. 특히 중국 본토 기업 비중이 높아 중국 경제와 정책 변화의 영향을 크게 받습니다.',
    url: 'https://finance.yahoo.com/quote/%5EHSI/',
  },
]

export default function Equity() {
  const navigate = useNavigate()

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: '"Times New Roman", Times, serif', color: '#000000' }}>

      {/* ── NAV ── */}
      <nav style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8e8e8' }}>
        <span onClick={() => navigate('/')} style={{ fontSize: '20px', fontWeight: '600', cursor: 'pointer' }}>Anthracite</span>
        <span style={{ fontSize: '14px', color: '#aaa' }}>01 — Equity Markets</span>
      </nav>

      {/* ── HEADER ── */}
      <section style={{ maxWidth: '860px', margin: '0 auto', padding: '80px 48px 64px' }}>
        <p style={{ fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '24px' }}>
          01 
        </p>
        <h1 style={{ fontSize: '52px', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '28px', lineHeight: '1.1' }}>
          Equity Markets
        </h1>
        <p style={{ fontSize: '18px', lineHeight: '1.85', color: '#444', maxWidth: '640px', textAlign: 'justify', wordBreak: 'keep-all' }}>
          S&P 500, Nasdaq 100, FTSE 100, KOSPI, Nikkei 225, Hang Seng 등을 통해 주요 국가별 시장 흐름을 비교하며 글로벌 주식시장의 방향성을 파악합니다. 이러한 지수들은 시가총액과 유동성 등을 기준으로 구성 종목이 정기적으로 조정되며, 종목별 비중은 시장 가격 변화에 따라 지속적으로 변화합니다.
        </p>
      </section>

      {/* ── INDICES ── */}
      <section style={{ maxWidth: '860px', margin: '0 auto', padding: '0 48px 160px' }}>
        <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '64px' }}>

          {indices.map((item) => (
            <div
              key={item.name}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.6fr',
                gap: '48px',
                padding: '56px 0',
                borderBottom: '1px solid #e8e8e8',
                alignItems: 'start',
              }}
            >
              {/* 왼쪽: 지수 이름 */}
              <div>
                <p style={{ fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: '12px' }}>
                  {item.region}
                </p>
                <h2 style={{ fontSize: '36px', fontWeight: '400', letterSpacing: '-0.01em', lineHeight: '1.1', color: '#000' }}>
                  {item.name}
                </h2>
              </div>

              {/* 오른쪽: 설명 + 링크 */}
              <div>
                <p style={{ fontSize: '16px', lineHeight: '1.85', color: '#444', marginBottom: '28px', textAlign: 'justify', wordBreak: 'keep-all' }}>
                  {item.desc}
                </p>
                <a
                  href={item.url}
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
                    Yahoo Finance에서 보기 ↗
                  </div>
                </a>
              </div>
            </div>
          ))}

        </div>
      </section>

    </div>
  )
}