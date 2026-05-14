import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

interface YearData {
  age: number
  asset: number
}

function formatKorean(value: number): string {
  if (Math.abs(value) >= 1_0000_0000) {
    return (value / 1_0000_0000).toFixed(1).replace(/\.0$/, '') + '억'
  } else if (Math.abs(value) >= 10000) {
    return (value / 10000).toFixed(0) + '만'
  }
  return value.toLocaleString()
}

function formatInput(value: string): string {
  const num = value.replace(/[^0-9]/g, '')
  return num ? Number(num).toLocaleString() : ''
}

function parseInput(value: string): number {
  return Number(value.replace(/,/g, '')) || 0
}

export default function Simulator() {
  const navigate = useNavigate()

  const [age, setAge] = useState('')
  const [income, setIncome] = useState('')
  const [expense, setExpense] = useState('')
  const [asset, setAsset] = useState('')
  const [returnRate, setReturnRate] = useState('')
  const [inflationOn, setInflationOn] = useState(true)
  const [inflation, setInflation] = useState('2')

  const hasInput = age && income && expense && asset && returnRate

  const data: YearData[] = useMemo(() => {
    if (!hasInput) return []
    const startAge = parseInt(age)
    const annualIncome = parseInput(income)
    const annualExpense = parseInput(expense)
    const startAsset = parseInput(asset)
    const rate = parseFloat(returnRate) / 100
    const inflRate = inflationOn ? parseFloat(inflation) / 100 : 0

    const result: YearData[] = []
    let currentAsset = startAsset
    let currentExpense = annualExpense

    for (let a = startAge; a <= 100; a++) {
      result.push({ age: a, asset: currentAsset })
      currentAsset = currentAsset * (1 + rate) + annualIncome - currentExpense
      currentExpense = currentExpense * (1 + inflRate)
    }
    return result
  }, [age, income, expense, asset, returnRate, inflationOn, inflation, hasInput])

  const netIncrease = parseInput(income) - parseInput(expense)

  // 그래프 계산
  const graphData = data.filter((_, i) => i % 1 === 0)
  const maxAsset = Math.max(...graphData.map(d => d.asset), 0)
  const minAsset = Math.min(...graphData.map(d => d.asset), 0)
  const range = maxAsset - minAsset || 1

  const W = 600, H = 260, PL = 60, PR = 20, PT = 20, PB = 40
  const gW = W - PL - PR
  const gH = H - PT - PB

  const startAge = parseInt(age) || 20
  const totalYears = 100 - startAge

  const xOf = (a: number) => PL + ((a - startAge) / totalYears) * gW
  const yOf = (v: number) => PT + gH - ((v - minAsset) / range) * gH

  const polyline = graphData.map(d => `${xOf(d.age)},${yOf(d.asset)}`).join(' ')

  // y축 레이블 4단계
  const yTicks = [0, 1, 2, 3, 4].map(i => minAsset + (range * i) / 4)

  // x축 10년 단위
  const xTicks: number[] = []
  for (let a = startAge; a <= 100; a++) {
    if ((a - startAge) % 10 === 0 || a === 100) xTicks.push(a)
  }

  // 세로 그리드 5년 단위
  const xGrids: number[] = []
  for (let a = startAge; a <= 100; a++) {
    if ((a - startAge) % 5 === 0) xGrids.push(a)
  }

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

        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }

        .sim-input {
          width: 100%;
          border: none;
          border-bottom: 1px solid #e8e8e8;
          padding: 10px 0;
          font-size: 16px;
          font-family: "Times New Roman", Times, serif;
          outline: none;
          background: transparent;
          color: #000;
          transition: border-color 0.2s;
        }
        .sim-input:focus { border-bottom-color: #000; }
        .sim-input::placeholder { color: #ccc; }

        .toggle {
          width: 40px; height: 22px;
          background: #e8e8e8;
          border-radius: 11px;
          position: relative;
          cursor: pointer;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .toggle.on { background: #000; }
        .toggle::after {
          content: '';
          position: absolute;
          width: 16px; height: 16px;
          background: #fff;
          border-radius: 50%;
          top: 3px; left: 3px;
          transition: transform 0.2s;
        }
        .toggle.on::after { transform: translateX(18px); }

        .table-row:hover { background: #fafafa; }
      `}</style>

      <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: '"Times New Roman", Times, serif', color: '#000' }}>

        {/* NAV */}
        <nav style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8e8e8' }}>
          <span onClick={() => navigate('/')} style={{ fontSize: '22px', fontWeight: '600', cursor: 'pointer' }}>Anthracite</span>
        </nav>

        <div style={{ maxWidth: '860px', margin: '0 auto', padding: '80px 48px 120px' }}>

          {/* HEADER */}
          <h1 className="page-title" style={{ fontSize: '52px', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '16px', lineHeight: '1.1' }}>
            Simulator
          </h1>
          <p className="page-desc" style={{ fontSize: '18px', lineHeight: '1.85', color: '#444', maxWidth: '640px', marginBottom: '64px', textAlign: 'justify', wordBreak: 'keep-all' }}>
            나이, 소득, 소비, 자산, 수익률을 입력하면 100세까지의 자산 추이를 예측합니다.
          </p>

          {/* INPUT SECTION */}
          <div className="page-section" style={{ borderTop: '1px solid #e8e8e8', paddingTop: '48px', marginBottom: '64px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px 48px' }}>

              {/* 현재 나이 */}
              <div>
                <p style={{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: '10px' }}>현재 나이</p>
                <input
                  className="sim-input"
                  type="number"
                  placeholder="예: 30"
                  value={age}
                  onChange={e => setAge(e.target.value)}
                />
              </div>

              {/* 연 수입 */}
              <div>
                <p style={{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: '10px' }}>연 수입 (원)</p>
                <input
                  className="sim-input"
                  type="text"
                  placeholder="예: 40,000,000"
                  value={income}
                  onChange={e => setIncome(formatInput(e.target.value))}
                />
              </div>

              {/* 연 소비 */}
              <div>
                <p style={{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: '10px' }}>연 소비 (원)</p>
                <input
                  className="sim-input"
                  type="text"
                  placeholder="예: 24,000,000"
                  value={expense}
                  onChange={e => setExpense(formatInput(e.target.value))}
                />
              </div>

              {/* 내 자산 */}
              <div>
                <p style={{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: '10px' }}>내 자산 (원)</p>
                <input
                  className="sim-input"
                  type="text"
                  placeholder="예: 50,000,000"
                  value={asset}
                  onChange={e => setAsset(formatInput(e.target.value))}
                />
              </div>

              {/* 연 수익률 */}
              <div>
                <p style={{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: '10px' }}>연 수익률 (%)</p>
                <input
                  className="sim-input"
                  type="number"
                  placeholder="예: 7"
                  value={returnRate}
                  onChange={e => setReturnRate(e.target.value)}
                />
                <p style={{ fontSize: '12px', color: '#bbb', marginTop: '6px' }}>S&P 500 100% → 약 7~10%</p>
              </div>

              {/* 물가상승률 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <p style={{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa' }}>물가상승률 반영</p>
                  <div className={`toggle ${inflationOn ? 'on' : ''}`} onClick={() => setInflationOn(v => !v)} />
                </div>
                <input
                  className="sim-input"
                  type="number"
                  placeholder="기본 2%"
                  value={inflation}
                  onChange={e => setInflation(e.target.value)}
                  disabled={!inflationOn}
                  style={{ opacity: inflationOn ? 1 : 0.35 }}
                />
                <p style={{ fontSize: '12px', color: '#bbb', marginTop: '6px' }}>연 소비가 매년 물가상승률만큼 증가한다고 가정합니다.</p>
              </div>

            </div>
          </div>

          {/* RESULTS */}
          {!hasInput ? (
            <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '64px' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '400', marginBottom: '24px', color: '#000' }}>
                100세까지 내 자산을 예측해 보세요!
              </h2>
              <p style={{ fontSize: '16px', lineHeight: '1.85', color: '#555', maxWidth: '560px', marginBottom: '48px', textAlign: 'justify', wordBreak: 'keep-all' }}>
                복리는 시간이 지날수록 눈덩이처럼 불어나요. 처음엔 느리게 느껴지지만, 10년, 20년이 지나면 수익이 수익을 낳는 폭발적인 성장이 시작돼요.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  '내 자산 → 직접 입력',
                  '연 소비 → 직접 입력',
                  '연 수익률 → 직접 입력',
                ].map((text, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#000', flexShrink: 0 }} />
                    <p style={{ fontSize: '15px', color: '#555' }}>{text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '64px', display: 'flex', flexDirection: 'column', gap: '56px' }}>

              {/* 1. 연간 순 증가 카드 */}
              <div>
                <p style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '20px' }}>연간 순 증가</p>
                <div style={{ padding: '32px 36px', border: '1px solid #e8e8e8', borderRadius: '4px', display: 'flex', alignItems: 'baseline', gap: '16px' }}>
                  <span style={{ fontSize: '42px', fontWeight: '400', color: netIncrease >= 0 ? '#000' : '#ff3b30', letterSpacing: '-0.02em' }}>
                    {netIncrease >= 0 ? '+' : ''}{netIncrease.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '16px', color: '#aaa' }}>원 / 년</span>
                </div>
                <p style={{ fontSize: '13px', color: '#aaa', marginTop: '10px' }}>
                  연 수입 {parseInput(income).toLocaleString()}원 — 연 소비 {parseInput(expense).toLocaleString()}원
                </p>
              </div>

              {/* 2. 그래프 */}
              <div>
                <p style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '20px' }}>예상 자산 추이</p>
                <div style={{ overflowX: 'auto' }}>
                  <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: '400px', height: 'auto' }}>
                    {/* 가로 그리드 */}
                    {yTicks.map((v, i) => (
                      <g key={i}>
                        <line x1={PL} y1={yOf(v)} x2={W - PR} y2={yOf(v)} stroke="#f0f0f0" strokeWidth="1" />
                        <text x={PL - 6} y={yOf(v) + 4} textAnchor="end" fontSize="10" fill="#bbb" fontFamily="system-ui">
                          {formatKorean(v)}
                        </text>
                      </g>
                    ))}
                    {/* 세로 그리드 5년 */}
                    {xGrids.map(a => (
                      <line key={a} x1={xOf(a)} y1={PT} x2={xOf(a)} y2={PT + gH} stroke="#f0f0f0" strokeWidth="1" />
                    ))}
                    {/* 0선 */}
                    {minAsset < 0 && (
                      <line x1={PL} y1={yOf(0)} x2={W - PR} y2={yOf(0)} stroke="#e0e0e0" strokeWidth="1" strokeDasharray="4 2" />
                    )}
                    {/* 꺾은선 */}
                    <polyline points={polyline} fill="none" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    {/* x축 레이블 10년 단위 */}
                    {xTicks.map(a => (
                      <text key={a} x={xOf(a)} y={PT + gH + 20} textAnchor="middle" fontSize="10" fill="#aaa" fontFamily="system-ui">
                        {a}세
                      </text>
                    ))}
                    {/* 축선 */}
                    <line x1={PL} y1={PT} x2={PL} y2={PT + gH} stroke="#e8e8e8" strokeWidth="1" />
                    <line x1={PL} y1={PT + gH} x2={W - PR} y2={PT + gH} stroke="#e8e8e8" strokeWidth="1" />
                  </svg>
                </div>
              </div>

              {/* 3. 테이블 */}
              <div>
                <p style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '20px' }}>나이별 예상 자산</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e8e8e8' }}>
                      <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: '400', color: '#aaa', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>나이</th>
                      <th style={{ textAlign: 'right', padding: '12px 0', fontWeight: '400', color: '#aaa', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>예상 자산</th>
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

        <footer style={{ borderTop: '1px solid #e8e8e8', padding: '32px 48px', fontSize: '12px', color: '#aaa' }}>
          <span>Anthracite © 2026</span>
        </footer>
      </div>
    </>
  )
}