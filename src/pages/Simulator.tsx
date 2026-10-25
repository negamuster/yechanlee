import { useState, useMemo } from 'react'
import type { WheelEvent } from 'react'
import ToolPage from '../components/ToolPage'
import { projectAssets } from '../lib/financialMath'

function formatInput(value: string): string {
  const num = value.replace(/[^0-9]/g, '')
  return num ? Number(num).toLocaleString('ko-KR') : ''
}
function parseInput(value: string): number {
  return Number(value.replace(/,/g, '')) || 0
}
function formatKorean(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_0000_0000) return (value / 1_0000_0000).toFixed(1).replace(/\.0$/, '') + '억'
  if (abs >= 10000) return Math.round(value / 10000) + '만'
  return value.toLocaleString('ko-KR')
}
const handleWheel = (event: WheelEvent<HTMLInputElement>) => event.currentTarget.blur()

function SimulatorInput({ label, value, onChange, money = false, placeholder = '0', hint, integer = false, min, max }: {
  label: string; value: string; onChange: (value: string) => void; money?: boolean; placeholder?: string; hint?: string; integer?: boolean; min?: number; max?: number
}) {
  return <label className="tool-field">
    <span>{label}</span>
    <input className="sim-input" type={money ? 'text' : 'number'} inputMode={money || integer ? 'numeric' : 'decimal'}
      step={integer ? 1 : 'any'} min={min} max={max} value={value} placeholder={placeholder}
      onChange={event => onChange(money ? formatInput(event.target.value) : event.target.value)} onWheel={money ? undefined : handleWheel} />
    {hint && <small>{hint}</small>}
  </label>
}

export default function Simulator() {
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

  const [mortgageRate, setMortgageRate] = useState('')
  const [otherDebtRate, setOtherDebtRate] = useState('')
  const [mortgagePrincipal, setMortgagePrincipal] = useState('')
  const [otherPrincipal, setOtherPrincipal] = useState('')

  const hasInput = currentAge && (savings || stocks || other) && expense && income
  const invalidAge = [currentAge, retireAge].some(value => value !== '' && (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 100))

  const data = useMemo(() => hasInput ? projectAssets({
    age: Number(currentAge), retireAge: retireAge ? Number(retireAge) : 100,
    assets: [
      { balance: parseInput(savings), rate: Number(savingsRate) },
      { balance: parseInput(stocks), rate: Number(stocksRate) },
      { balance: parseInput(other), rate: Number(otherRate) },
    ],
    debts: [
      { balance: parseInput(mortgage), rate: Number(mortgageRate), annualPrincipal: parseInput(mortgagePrincipal) },
      { balance: parseInput(otherDebt), rate: Number(otherDebtRate), annualPrincipal: parseInput(otherPrincipal) },
    ],
    income: parseInput(income), expense: parseInput(expense),
    incomeGrowth: Number(incomeGrowth), expenseGrowth: Number(expenseGrowth),
  }) : [], [currentAge, retireAge, savings, savingsRate, stocks, stocksRate, other, otherRate, expense, expenseGrowth, income, incomeGrowth, mortgage, otherDebt, mortgageRate, otherDebtRate, mortgagePrincipal, otherPrincipal, hasInput])
  const netIncrease = data[0]?.cashFlow ?? 0
  const firstGap = data.find(row => row.fundingGap > 0)

  const W = 620, H = 280, PL = 64, PR = 20, PT = 20, PB = 44
  const gW = W - PL - PR
  const gH = H - PT - PB
  // The projection has already validated ages and contains at most 101 rows.
  // Never iterate over raw input: even an incomplete invalid age must stay bounded.
  const startAge = data[0]?.age ?? 0
  const totalYears = 100 - startAge || 1
  const maxAsset = data.length ? Math.max(...data.map(d => d.asset), 0) : 0
  const minAsset = data.length ? Math.min(...data.map(d => d.asset), 0) : 0
  const range = maxAsset - minAsset || 1
  const xOf = (a: number) => PL + ((a - startAge) / totalYears) * gW
  const yOf = (v: number) => PT + gH - ((v - minAsset) / range) * gH
  const xTicks = data.filter(row => (row.age - startAge) % 10 === 0 || row.age === 100).map(row => row.age)
  const xGrids = data.filter(row => (row.age - startAge) % 5 === 0).map(row => row.age)
  const yTicks = [0, 1, 2, 3, 4].map(i => minAsset + (range * i) / 4)
  const polyline = data.map(d => `${xOf(d.age)},${yOf(d.asset)}`).join(' ')
  const dots = data.filter((_, i) => i % 5 === 0)


  return <ToolPage className="simulator-page" title="자산 시뮬레이터"
    description="자산·소득·지출과 수익률 가정을 입력해 100세까지의 순자산 변화를 계산합니다. 실제 미래 수익을 예측하는 모델은 아닙니다.">
    <div className="simulator-sections">
      <section className="tool-card" aria-labelledby="sim-age-heading">
        <div className="tool-card-heading"><h2 id="sim-age-heading">나이</h2></div>
        <div className="sim-field-grid">
          <SimulatorInput label="현재 나이" integer min={0} max={100} value={currentAge} onChange={setCurrentAge} placeholder="예: 25" />
          <SimulatorInput label="은퇴 나이" integer min={0} max={100} value={retireAge} onChange={setRetireAge} placeholder="예: 60" hint="수입이 없어지는 나이 · 미입력 시 100세" />
        </div>
      </section>
      <section className="tool-card" aria-labelledby="sim-assets-heading">
        <div className="tool-card-heading"><h2 id="sim-assets-heading">금융·기타 자산</h2><span className="tool-meta">금액 단위: 원</span></div>
        <p className="tool-section-note">부채를 차감하기 전 자산을 입력하세요. 주택담보대출이 있다면 대응하는 주택 가치도 기타 자산에 포함하세요.</p>
        <div className="sim-field-rows">
          <div className="sim-field-grid">
            <SimulatorInput label="은행 저축 · 예금 (원)" money value={savings} onChange={setSavings} placeholder="예: 10,000,000" />
            <SimulatorInput label="예금 연 수익률 (%)" value={savingsRate} onChange={setSavingsRate} placeholder="예: 3.5" hint="예금·적금 이율" />
          </div>
          <div className="sim-field-grid">
            <SimulatorInput label="증권사 주식 · 펀드 (원)" money value={stocks} onChange={setStocks} placeholder="예: 30,000,000" />
            <SimulatorInput label="주식·펀드 연 수익률 (%)" value={stocksRate} onChange={setStocksRate} placeholder="예: 8" hint="미래 수익률 가정 · 음수도 입력 가능" />
          </div>
          <div className="sim-field-grid">
            <SimulatorInput label="기타 자산 · 부동산 등 (원)" money value={other} onChange={setOther} placeholder="예: 5,000,000" />
            <SimulatorInput label="기타 자산 연 수익률 (%)" value={otherRate} onChange={setOtherRate} placeholder="예: 5" hint="미래 수익률 가정 · 음수도 입력 가능" />
          </div>
        </div>
      </section>
      <section className="tool-card" aria-labelledby="sim-cashflow-heading">
        <div className="tool-card-heading"><h2 id="sim-cashflow-heading">연 소비·수입</h2></div>
        <div className="sim-field-rows">
          <div className="sim-field-grid">
            <SimulatorInput label="연간 평균 소비 (원)" money value={expense} onChange={setExpense} placeholder="예: 24,000,000" />
            <SimulatorInput label="연 소비 증가율 (%)" value={expenseGrowth} onChange={setExpenseGrowth} placeholder="예: 2" hint="명목 금액 기준" />
          </div>
          <div className="sim-field-grid">
            <SimulatorInput label="연 수입 (원)" money value={income} onChange={setIncome} placeholder="예: 40,000,000" />
            <SimulatorInput label="연 수입 증가율 (%)" value={incomeGrowth} onChange={setIncomeGrowth} placeholder="예: 3" hint="연봉 인상률 기준" />
          </div>
        </div>
      </section>
      <section className="tool-card" aria-labelledby="sim-debt-heading">
        <div className="tool-card-heading"><h2 id="sim-debt-heading">부채·상환</h2></div>
        <p className="tool-section-note">이자는 매년 초 대출 잔액에 적용합니다. 원금은 연말에 입력한 금액만큼 상환하며 잔액보다 많이 갚지 않습니다. 금리와 상환액을 비우면 0으로 계산합니다.</p>
        <div className="sim-field-rows">
          <div className="sim-field-grid sim-debt-grid">
            <SimulatorInput label="주택담보대출 (원)" money value={mortgage} onChange={setMortgage} placeholder="예: 200,000,000" />
            <SimulatorInput label="주택담보대출 연 이자율 (%)" value={mortgageRate} onChange={setMortgageRate} />
            <SimulatorInput label="주택담보대출 연 원금 상환액 (원)" money value={mortgagePrincipal} onChange={setMortgagePrincipal} />
          </div>
          <div className="sim-field-grid sim-debt-grid">
            <SimulatorInput label="기타 대출 (원)" money value={otherDebt} onChange={setOtherDebt} placeholder="예: 10,000,000" />
            <SimulatorInput label="기타 대출 연 이자율 (%)" value={otherDebtRate} onChange={setOtherDebtRate} />
            <SimulatorInput label="기타 대출 연 원금 상환액 (원)" money value={otherPrincipal} onChange={setOtherPrincipal} />
          </div>
        </div>
        <p className="tool-section-note sim-debt-note">연 소비에는 여기 입력한 대출 이자·원금 상환액을 중복 입력하지 마세요.</p>
      </section>
      <details className="tool-card tool-disclosure">
        <summary>계산 가정</summary>
        <div className="tool-disclosure-content">
          <p>연초 자산에 수익률을 적용하고 연말에 소득·소비·대출 이자·원금 상환을 반영합니다. 최초 자산 비중으로 매년 재조정한다고 가정하며 초기 자산이 0원이면 수익률은 0%입니다. 세금·수수료·수익률 변동은 반영하지 않습니다.</p>
          <p>잉여자금은 같은 자산 비중으로 재투자합니다. 자산이 부족하면 부족자금을 별도 표시하고 순자산에서 차감합니다. 부족자금의 추가 대출 이자와 실제 대출 가능 여부는 반영하지 않습니다.</p>
          <p>소득·소비·수익률과 대출 조건에 따라 결과가 달라집니다. 0원도 입력할 수 있으며, 나이별 금액은 해당 나이의 연초 기준입니다.</p>
        </div>
      </details>
      {(invalidAge || hasInput && !data.length) && <p role="alert" className="tool-callout">나이는 0~100의 정수, 자산 수익률·소득 및 소비 증가율은 -100~1,000%, 대출 금리는 0~1,000% 범위로 입력해 주세요.</p>}
      {firstGap && <p role="status" className="tool-callout">{firstGap.age}세부터 자산만으로 지출·상환을 충당할 수 없습니다. 아래 부족자금은 추가 조달이 필요한 누적 금액입니다.</p>}
      {!hasInput || !data.length ? <section className="tool-card tool-empty" aria-labelledby="sim-empty-heading">
        <h2 id="sim-empty-heading">가정을 입력해 순자산 변화를 비교하세요</h2>
        <p>현재 나이·자산·연 소비·연 수입을 입력하면 결과가 표시됩니다. 0원도 입력할 수 있습니다.</p>
      </section> : <>
        <section className="tool-card sim-cashflow-result" aria-labelledby="sim-result-heading">
          <div className="tool-card-heading"><h2 id="sim-result-heading">첫해 상환 후 현금흐름</h2></div>
          <p className={`sim-result-value${netIncrease < 0 ? ' tool-negative' : ''}`}>
            {netIncrease >= 0 ? '+' : ''}{netIncrease.toLocaleString('ko-KR')}<span>원 / 년</span>
          </p>
          <p className="tool-meta">은퇴 여부 반영 소득 − 소비 − 이자 {Math.round(data[0]?.interest ?? 0).toLocaleString('ko-KR')}원 − 원금 {Math.round(data[0]?.principal ?? 0).toLocaleString('ko-KR')}원 · 투자 수익 제외</p>
        </section>
        <section className="tool-card" aria-labelledby="sim-chart-heading">
          <div className="tool-card-heading"><h2 id="sim-chart-heading">가정에 따른 순자산 추이</h2></div>
          <p className="tool-scroll-hint">좌우로 밀어 차트 전체 보기</p>
          <div className="tool-chart-scroll" tabIndex={0} role="region" aria-label="연령별 순자산 차트, 좌우로 스크롤">
            <svg viewBox={`0 0 ${W} ${H}`} className="sim-chart" role="img" aria-label="입력한 가정에 따른 100세까지의 연초 순자산 추이">
              {yTicks.map((value, index) => <g key={index}>
                <line className="sim-gridline" x1={PL} y1={yOf(value)} x2={W - PR} y2={yOf(value)} />
                <text x={PL - 6} y={yOf(value) + 4} textAnchor="end">{formatKorean(value)}</text>
              </g>)}
              {xGrids.map(age => <line key={age} className="sim-gridline" x1={xOf(age)} y1={PT} x2={xOf(age)} y2={PT + gH} />)}
              {minAsset < 0 && <line className="sim-axis" x1={PL} y1={yOf(0)} x2={W - PR} y2={yOf(0)} strokeDasharray="4 2" />}
              <polyline className="sim-trend" points={polyline} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {dots.map(row => <circle key={row.age} className="sim-dot" cx={xOf(row.age)} cy={yOf(row.asset)} r="2.5" />)}
              {xTicks.map(age => <text key={age} x={xOf(age)} y={PT + gH + 18} textAnchor="middle">{age}세</text>)}
              <line className="sim-axis" x1={PL} y1={PT} x2={PL} y2={PT + gH} />
              <line className="sim-axis" x1={PL} y1={PT + gH} x2={W - PR} y2={PT + gH} />
            </svg>
          </div>
        </section>
        <section className="tool-card" aria-labelledby="sim-table-heading">
          <div className="tool-card-heading"><h2 id="sim-table-heading">나이별 연초 자산·부채</h2><span className="tool-meta">단위: 원</span></div>
          <p className="tool-scroll-hint">좌우로 밀어 표 전체 보기</p>
          <div className="tool-table-scroll sim-table-scroll" tabIndex={0} role="region" aria-label="나이별 연초 자산과 부채 표, 좌우·상하로 스크롤">
            <table className="tool-table sim-table">
              <caption className="tool-sr-only">나이별 연초 총자산·대출 잔액·부족자금·순자산, 단위 원</caption>
              <thead><tr><th scope="col">나이</th>{['총자산', '대출 잔액', '부족자금', '순자산'].map(label => <th key={label} scope="col" className="tool-numeric">{label}</th>)}</tr></thead>
              <tbody>{data.map(row => <tr key={row.age}>
                <th scope="row">{row.age}세</th>
                {[row.grossAssets, row.debt, row.fundingGap].map((value, index) => <td key={index} className="tool-numeric">{Math.round(value).toLocaleString('ko-KR')}</td>)}
                <td className={`tool-numeric${row.asset < 0 ? ' tool-negative' : ''}`}>{Math.round(row.asset).toLocaleString('ko-KR')}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>
      </>}
    </div>
  </ToolPage>
}
