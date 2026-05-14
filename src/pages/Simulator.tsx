import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

function formatInput(value: string): string {
  const num = value.replace(/[^0-9]/g, '')
  return num ? Number(num).toLocaleString() : ''
}

function parseInput(value: string): number {
  return Number(value.replace(/,/g, '')) || 0
}

function formatKorean(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_0000_0000) return (value / 1_0000_0000).toFixed(1).replace(/\.0$/, '') + '억'
  if (abs >= 10000) return Math.round(value / 10000) + '만'
  return value.toLocaleString()
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: 'none',
  borderBottom: '1px solid #e8e8e8',
  padding: '10px 0',
  fontSize: '16px',
  fontFamily: '"Times New Roman", Times, serif',
  outline: 'none',
  background: 'transparent',
  color: '#000',
  transition: 'border-color 0.2s',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  letterSpacing: '0.15em',
  textTransform: 'uppercase' as const,
  color: '#000',
  marginBottom: '8px',
  fontWeight: '500',
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  letterSpacing: '0.08em',
  color: '#000',
  marginBottom: '8px',
}

const hintStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#ccc',
  marginTop: '5px',
}

interface YearData {
  age: number
  asset: number
}

export default function Simulator() {
  const navigate = useNavigate()

  const [currentAge, setCurrentAge] = useState('')
  const [retireAge, setRetireAge] = useState('')
  const [savings, setSavings] = useState('')
  const [savingsRate, setSavingsRate] = useState('')
  const [stocks, setStocks] = useState('')
  const [stocksRate, setStocksRate] = useState('')
  const [other, setOther] = useState('')
  const [otherRate, setOtherRate] = useState('')
  const [expense, setExpense] = useState('')
  const [expenseGrowth, setExpenseGrowth] = useState('')
  const [income, setIncome] = useState('')
  const [incomeGrowth, setIncomeGrowth] = useState('')
  const [mortgage, setMortgage] = useState('')
  const [otherDebt, setOtherDebt] = useState('')

  const hasInput = currentAge && (savings || stocks || other) && expense && income

  const data: YearData[] = useMemo(() => {
    if (!hasInput) return []
    const startAge = parseInt(currentAge)
    const retireAgeNum = retireAge ? parseInt(retireAge) : 100
    const totalAsset = parseInput(savings) + parseInput(stocks) + parseInput(other)
    const totalDebt = parseInput(mortgage) + parseInput(otherDebt)
    let netAsset = totalAsset - totalDebt
    const totalForRate = totalAsset || 1
    const weightedRate = (
      parseInput(savings) * (parseFloat(savingsRate) || 0) +
      parseInput(stocks) * (parseFloat(stocksRate) || 0) +
      parseInput(other) * (parseFloat(otherRate) || 0)
    ) / totalForRate / 100
    let currentExpense = parseInput(expense)
    let currentIncome = parseInput(income)
    const expGrowthRate = (parseFloat(expenseGrowth) || 0) / 100
    const incGrowthRate = (parseFloat(incomeGrowth) || 0) / 100
    const result: YearData[] = []
    for (let age = startAge; age <= 100; age++) {
      result.push({ age, asset: netAsset })
      const effectiveIncome = age >= retireAgeNum ? 0 : currentIncome
      netAsset = netAsset * (1 + weightedRate) + effectiveIncome - currentExpense
      currentExpense = currentExpense * (1 + expGrowthRate)
      currentIncome = currentIncome * (1 + incGrowthRate)
    }
    return result
  }, [currentAge, retireAge, savings, savingsRate, stocks, stocksRate, other, otherRate, expense, expenseGrowth, income, incomeGrowth, mortgage, otherDebt, hasInput])

  const netIncrease = parseInput(income) - parseInput(expense)

  const W = 620, H = 280, PL = 64, PR = 20, PT = 20, PB = 44
  const gW = W - PL - PR
  const gH = H - PT - PB
  const startAge = parseInt(currentAge) || 20
  const totalYears = 100 - startAge || 1
  const maxAsset = data.length ? Math.max(...data.map(d => d.asset), 0) : 0
  const minAsset = data.length ? Math.min(...data.map(d => d.asset), 0) : 0
  const range = maxAsset - minAsset || 1
  const xOf = (a: number) => PL + ((a - startAge) / totalYears) * gW
  const yOf = (v: number) => PT + gH - ((v - minAsset) / range) * gH
  const xTicks: number[] = []
  for (let a = startAge; a <= 100; a++) {
    if ((a - startAge) % 10 === 0 || a === 100) xTicks.push(a)
  }
  const xGrids: number[] = []
  for (let a = startAge; a <= 100; a++) {
    if ((a - startAge) % 5 === 0) xGrids.push(a)
  }
  const yTicks = [0, 1, 2, 3, 4].map(i => minAsset + (range * i) / 4)
  const polyline = data.map(d => `${xOf(d.age)},${yOf(d.asset)}`).join(' ')
  const dots = data.filter((_, i) => i % 5 === 0)

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
        input::-webkit-inner-spin-button,
        input::-webkit-outer-spin-button { -webkit-appearance: none; }
        .sim-input:focus { border-bottom-color: #000 !important; }
        .sim-input::placeholder { color: #ddd; }
        .table-row:hover { background: #fafafa; }
      `}</style>

      <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: '"Times New Roman", Times, serif', color: '#000' }}>

        <nav style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8e8e8' }}>
          <span onClick={() => navigate('/')} style={{ fontSize: '22px', fontWeight: '600', cursor: 'pointer' }}>Anthracite</span>
        </nav>

        <div style={{ maxWidth: '860px', margin: '0 auto', padding: '80px 48px 120px' }}>

          <h1 className="page-title" style={{ fontSize: '52px', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '16px', lineHeight: '1.1' }}>
            Simulator
          </h1>
          <p className="page-desc" style={{ fontSize: '18px', lineHeight: '1.85', color: '#444', maxWidth: '640px', marginBottom: '64px', textAlign: 'justify', wordBreak: 'keep-all' }}>
            나이, 자산, 소득, 소비, 부채를 입력하면 100세까지의 순자산 추이를 예측합니다.
          </p>

          <div className="page-section">

            {/* ── 나이 ── */}
            <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '48px', marginBottom: '48px' }}>
              <p style={sectionTitleStyle}>나이</p>
              <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '28px' }}> </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px 48px' }}>
                <div>
                  <p style={labelStyle}>현재 나이</p>
                  <input className="sim-input" style={inputStyle} type="number" placeholder="예: 25" value={currentAge} onChange={e => setCurrentAge(e.target.value)} />
                </div>
                <div>
                  <p style={labelStyle}>은퇴 나이</p>
                  <input className="sim-input" style={inputStyle} type="number" placeholder="예: 60" value={retireAge} onChange={e => setRetireAge(e.target.value)} />
                  <p style={hintStyle}>수입이 없어지는 나이</p>
                </div>
              </div>
            </div>

            {/* ── 금융 자산 ── */}
            <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '48px', marginBottom: '48px' }}>
              <p style={sectionTitleStyle}>금융 자산 (Financial Assets)</p>
              <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '28px' }}>부채를 제외한 순자산 기준 · 퇴직연금 포함</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '32px' }}>
                  <div>
                    <p style={labelStyle}>1. 은행 저축 · 예금 (원)</p>
                    <input className="sim-input" style={inputStyle} type="text" placeholder="예: 10,000,000" value={savings} onChange={e => setSavings(formatInput(e.target.value))} />
                  </div>
                  <div>
                    <p style={labelStyle}>연 수익률 (%)</p>
                    <input className="sim-input" style={inputStyle} type="number" placeholder="예: 3.5" value={savingsRate} onChange={e => setSavingsRate(e.target.value)} />
                    <p style={hintStyle}>예금, 적금 이율</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '32px' }}>
                  <div>
                    <p style={labelStyle}>2. 증권사 주식 · 펀드 (원)</p>
                    <input className="sim-input" style={inputStyle} type="text" placeholder="예: 30,000,000" value={stocks} onChange={e => setStocks(formatInput(e.target.value))} />
                  </div>
                  <div>
                    <p style={labelStyle}>연 수익률 (%)</p>
                    <input className="sim-input" style={inputStyle} type="number" placeholder="예: 8" value={stocksRate} onChange={e => setStocksRate(e.target.value)} />
                    <p style={hintStyle}>S&P 500 → 약 7~10%</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '32px' }}>
                  <div>
                    <p style={labelStyle}>3. 기타 자산 · 암호화폐 등 (원)</p>
                    <input className="sim-input" style={inputStyle} type="text" placeholder="예: 5,000,000" value={other} onChange={e => setOther(formatInput(e.target.value))} />
                  </div>
                  <div>
                    <p style={labelStyle}>연 수익률 (%)</p>
                    <input className="sim-input" style={inputStyle} type="number" placeholder="예: 10" value={otherRate} onChange={e => setOtherRate(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── 연 소비 ── */}
            <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '48px', marginBottom: '48px' }}>
              <p style={sectionTitleStyle}>연 소비</p>
              <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '28px' }}> </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '32px' }}>
                <div>
                  <p style={labelStyle}>연간 평균 소비 (원)</p>
                  <input className="sim-input" style={inputStyle} type="text" placeholder="예: 24,000,000" value={expense} onChange={e => setExpense(formatInput(e.target.value))} />
                </div>
                <div>
                  <p style={labelStyle}>연 소비 증가율 (%)</p>
                  <input className="sim-input" style={inputStyle} type="number" placeholder="예: 2" value={expenseGrowth} onChange={e => setExpenseGrowth(e.target.value)} />
                  <p style={hintStyle}>물가상승률 기준 약 2%</p>
                </div>
              </div>
            </div>

            {/* ── 연 수입 ── */}
            <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '48px', marginBottom: '48px' }}>
              <p style={sectionTitleStyle}>연 수입</p>
              <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '28px' }}> </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '32px' }}>
                <div>
                  <p style={labelStyle}>연 수입 (원)</p>
                  <input className="sim-input" style={inputStyle} type="text" placeholder="예: 40,000,000" value={income} onChange={e => setIncome(formatInput(e.target.value))} />
                </div>
                <div>
                  <p style={labelStyle}>연 수입 증가율 (%)</p>
                  <input className="sim-input" style={inputStyle} type="number" placeholder="예: 3" value={incomeGrowth} onChange={e => setIncomeGrowth(e.target.value)} />
                  <p style={hintStyle}>연봉 인상률 기준</p>
                </div>
              </div>
            </div>

            {/* ── 부채 ── */}
            <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '48px', marginBottom: '64px' }}>
              <p style={sectionTitleStyle}>내 부채</p>
              <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '28px' }}>총 자산에서 차감하여 순자산을 계산합니다</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px 48px' }}>
                <div>
                  <p style={labelStyle}>1. 주택담보대출 (원)</p>
                  <input className="sim-input" style={inputStyle} type="text" placeholder="예: 200,000,000" value={mortgage} onChange={e => setMortgage(formatInput(e.target.value))} />
                </div>
                <div>
                  <p style={labelStyle}>2. 기타 대출 (원)</p>
                  <input className="sim-input" style={inputStyle} type="text" placeholder="예: 10,000,000" value={otherDebt} onChange={e => setOtherDebt(formatInput(e.target.value))} />
                </div>
              </div>
            </div>

            {/* ── 결과 ── */}
            {!hasInput ? (
              <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '64px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: '400', marginBottom: '16px' }}>100세까지 내 자산을 예측해 보세요!</h2>
                <p style={{ fontSize: '16px', lineHeight: '1.85', color: '#555', maxWidth: '560px', textAlign: 'justify', wordBreak: 'keep-all' }}>
                  복리는 시간이 지날수록 눈덩이처럼 불어나요. 처음엔 느리게 느껴지지만, 10년, 20년이 지나면 수익이 수익을 낳는 폭발적인 성장이 시작돼요.
                </p>
              </div>
            ) : (
              <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '64px', display: 'flex', flexDirection: 'column', gap: '56px' }}>

                {/* 연간 순 증가 */}
                <div>
                  <p style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '16px' }}>연간 순 증가</p>
                  <div style={{ padding: '28px 32px', border: '1px solid #e8e8e8', borderRadius: '4px', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                    <span style={{ fontSize: '40px', fontWeight: '400', letterSpacing: '-0.02em', color: netIncrease >= 0 ? '#000' : '#ff3b30' }}>
                      {netIncrease >= 0 ? '+' : ''}{netIncrease.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '15px', color: '#aaa' }}>원 / 년</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#bbb', marginTop: '8px' }}>
                    연 수입 {parseInput(income).toLocaleString()}원 — 연 소비 {parseInput(expense).toLocaleString()}원
                  </p>
                </div>

                {/* 그래프 */}
                <div>
                  <p style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '16px' }}>예상 순자산 추이</p>
                  <div style={{ overflowX: 'auto' }}>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: '400px', height: 'auto' }}>
                      {yTicks.map((v, i) => (
                        <g key={i}>
                          <line x1={PL} y1={yOf(v)} x2={W - PR} y2={yOf(v)} stroke="#f0f0f0" strokeWidth="1" />
                          <text x={PL - 6} y={yOf(v) + 4} textAnchor="end" fontSize="10" fill="#bbb" fontFamily="system-ui">{formatKorean(v)}</text>
                        </g>
                      ))}
                      {xGrids.map(a => (
                        <line key={a} x1={xOf(a)} y1={PT} x2={xOf(a)} y2={PT + gH} stroke="#f0f0f0" strokeWidth="1" />
                      ))}
                      {minAsset < 0 && (
                        <line x1={PL} y1={yOf(0)} x2={W - PR} y2={yOf(0)} stroke="#e0e0e0" strokeWidth="1" strokeDasharray="4 2" />
                      )}
                      <polyline points={polyline} fill="none" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                      {dots.map(d => (
                        <circle key={d.age} cx={xOf(d.age)} cy={yOf(d.asset)} r="3.5" fill="#fff" stroke="#000" strokeWidth="1.5" />
                      ))}
                      {xTicks.map(a => (
                        <text key={a} x={xOf(a)} y={PT + gH + 18} textAnchor="middle" fontSize="10" fill="#aaa" fontFamily="system-ui">{a}세</text>
                      ))}
                      <line x1={PL} y1={PT} x2={PL} y2={PT + gH} stroke="#e8e8e8" strokeWidth="1" />
                      <line x1={PL} y1={PT + gH} x2={W - PR} y2={PT + gH} stroke="#e8e8e8" strokeWidth="1" />
                    </svg>
                  </div>
                </div>

                {/* 테이블 */}
                <div>
                  <p style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '16px' }}>나이별 예상 순자산</p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e8e8e8' }}>
                        <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: '400', color: '#aaa', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>나이</th>
                        <th style={{ textAlign: 'right', padding: '12px 0', fontWeight: '400', color: '#aaa', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>예상 순자산</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((row, i) => (
                        <tr key={i} className="table-row" style={{ borderBottom: '1px solid #f4f4f4' }}>
                          <td style={{ padding: '12px 0', color: '#000' }}>{row.age}세</td>
                          <td style={{ padding: '12px 0', textAlign: 'right', color: row.asset < 0 ? '#ff3b30' : '#000', fontVariantNumeric: 'tabular-nums' }}>
                            {row.asset < 0 ? '-' : row.asset.toLocaleString() + '원'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>
            )}
          </div>
        </div>

        <footer style={{ borderTop: '1px solid #e8e8e8', padding: '32px 48px', fontSize: '12px', color: '#aaa' }}>
          <span>Anthracite © 2026</span>
        </footer>
      </div>
    </>
  )
}