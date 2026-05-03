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
    desc: '나스닥에 상장된 비금융 대형 기업 100개로 구성된 지수로, 시가총액 가중 방식(일부 상한 적용)을 사용합니다. NVIDIA, Alphabet, Apple, Microsoft, Amazon 등 빅테크 기업의 비중이 높아 기술주 중심의 성장주 흐름을 대표하며, 금리 변화에 민감하게 반응하는 특징을 가지고 있어 시장의 성장 기대와 투자 심리를 파악하는 데 핵심적인 지표입니다.',
    url: 'https://finance.yahoo.com/quote/%5EIXIC/',
  },
  {
    name: 'Euro Stoxx 50',
    region: 'Europe',
    desc: '유로존 내 11개국에 상장된 시가총액 상위 50개 대형 기업으로 구성된 유럽 대표 지수입니다. 금융, 에너지, 산업재 등 다양한 섹터를 포함하며, 유럽 경기 흐름과 ECB(유럽중앙은행)의 통화정책 방향을 반영합니다. 유럽 주식시장 전반을 파악하는 핵심 벤치마크로 활용됩니다.',
    url: 'https://finance.yahoo.com/quote/%5ESTOXX50E/',
  },
  {
    name: 'FTSE 100',
    region: 'United Kingdom',
    desc: '런던증권거래소에 상장된 시가총액 상위 100개 기업으로 구성된 영국 대표 지수입니다. 영국 내수보다 글로벌 매출 비중이 높은 기업들로 구성되어 있어 국제경제 환경의 영향을 함께 반영합니다. 유럽 시장과 글로벌 경기 흐름을 파악하는 데 활용됩니다.',
    url: 'https://finance.yahoo.com/quote/%5EFTSE/',
  },
  {
    name: 'Nikkei 225',
    region: 'Japan',
    desc: '도쿄증권거래소에 상장된 225개 대표 기업으로 구성된 일본의 주요 주가지수로, 가격가중 방식으로 산출됩니다. 수출 기업 비중이 높아 엔화 환율과 역의 상관관계를 보이는 경우가 많으며, 일본은행(BOJ)의 통화정책 변화에 민감하게 반응하여 일본 경제와 글로벌 제조업 흐름을 파악하는 데 중요한 지표입니다.',
    url: 'https://finance.yahoo.com/quote/%5EN225/',
  },
  {
    name: 'Hang Seng',
    region: 'Hong Kong',
    desc: '홍콩증권거래소에 상장된 주요 대형 기업들로 구성된 시가총액 가중 지수입니다. 특히 중국 본토 기업 비중이 높아 중국 경제와 정책 변화의 영향을 크게 받으며, 아시아 신흥시장 투자 심리를 반영하는 주요 지표로 활용됩니다.',
    url: 'https://finance.yahoo.com/quote/%5EHSI/',
  },
  {
    name: 'KOSPI',
    region: 'South Korea',
    desc: '한국거래소 유가증권시장에 상장된 모든 보통주를 대상으로 산출되는 한국 대표 종합주가지수입니다. 수출 중심 산업 구조를 반영하며, 반도체·자동차 등 글로벌 경기에 민감한 산업 비중이 높아 글로벌 경기 변화에 민감하게 반응하는 특징을 가집니다.',
    url: 'https://finance.yahoo.com/quote/%5EKS11/',
  },
]

export default function Equity() {
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
        .link-item:hover { opacity: 0.4; }
      `}</style>

      <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: '"Times New Roman", Times, serif', color: '#000000' }}>

        <nav style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8e8e8' }}>
          <span onClick={() => navigate('/')} style={{ fontSize: '22px', fontWeight: '600', cursor: 'pointer' }}>Anthracite</span>
        </nav>

        <section style={{ maxWidth: '860px', margin: '0 auto', padding: '80px 48px 64px' }}>
          <h1 className="page-title" style={{ fontSize: '52px', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '28px', lineHeight: '1.1' }}>
            Stock Market
          </h1>
          <p className="page-desc" style={{ fontSize: '18px', lineHeight: '1.85', color: '#444', maxWidth: '640px', textAlign: 'justify', wordBreak: 'keep-all' }}>
            주식시장은 기업의 소유권을 나타내는 주식이 투자자 간에 거래되는 시장으로, 기업의 자금 조달과 투자자의 자본 참여가 이루어지는 핵심 금융 시장입니다. 주식 가격은 기업의 실적뿐 아니라 금리, 경제 성장, 정책 변화 등 다양한 요인을 반영하며, 경제 전반의 흐름과 기대를 보여주는 중요한 지표로 작용합니다.
          </p>
        </section>

        <section className="page-section" style={{ maxWidth: '860px', margin: '0 auto', padding: '0 48px 160px' }}>
          <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '64px' }}>
            {indices.map((item) => (
              <div key={item.name} style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '48px', padding: '56px 0', borderBottom: '1px solid #e8e8e8', alignItems: 'start' }}>
                <div>
                  <p style={{ fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: '12px' }}>{item.region}</p>
                  <h2 style={{ fontSize: '36px', fontWeight: '400', letterSpacing: '-0.01em', lineHeight: '1.1', color: '#000' }}>{item.name}</h2>
                </div>
                <div>
                  <p style={{ fontSize: '16px', lineHeight: '1.85', color: '#444', marginBottom: '28px', textAlign: 'justify', wordBreak: 'keep-all' }}>{item.desc}</p>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                    <div
                      className="link-item"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#000', borderBottom: '1px solid #000', paddingBottom: '2px', cursor: 'pointer', transition: 'opacity 0.15s' }}
                    >
                      Yahoo Finance에서 보기 ↗
                    </div>
                  </a>
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