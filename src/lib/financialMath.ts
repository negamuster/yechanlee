export function portfolioPercent(value: number, total: number): number {
  return total > 0 && Number.isFinite(total) && Number.isFinite(value) ? Math.round(value / total * 1000) / 10 : 0
}

export function portfolioSlices(holdings: { name: string; value: number }[], total: number) {
  if (!Number.isFinite(total) || total <= 0) return []
  const top = holdings.filter(h => Number.isFinite(h.value) && h.value > 0).slice().sort((a, b) => b.value - a.value).slice(0, 10)
  const other = Math.max(0, total - top.reduce((sum, h) => sum + h.value, 0))
  return [...top.map(h => ({ ...h, other: false })), ...(other > 0 ? [{ name: '기타 보유종목', value: other, other: true }] : [])]
    .map(h => ({ ...h, fraction: h.value / total, pct: portfolioPercent(h.value, total) }))
}

export interface ProjectionInput {
  age: number; retireAge: number
  assets: { balance: number; rate: number }[]
  debts: { balance: number; rate: number; annualPrincipal: number }[]
  income: number; expense: number; incomeGrowth: number; expenseGrowth: number
}
export interface ProjectionYear {
  age: number; asset: number; grossAssets: number; debt: number; fundingGap: number
  interest: number; principal: number; cashFlow: number; investmentReturn: number
}

export function projectAssets(input: ProjectionInput): ProjectionYear[] {
  const { age, retireAge, assets, debts, incomeGrowth, expenseGrowth } = input
  const valid = (n: number, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isFinite(n) && n >= min && n <= max
  if (!Number.isInteger(age) || !valid(age, 0, 100) || !Number.isInteger(retireAge) || !valid(retireAge, 0, 100)
    || !valid(input.income, 0) || !valid(input.expense, 0)
    || !valid(incomeGrowth, -100, 1000) || !valid(expenseGrowth, -100, 1000)
    || assets.some(a => !valid(a.balance, 0) || !valid(a.rate, -100, 1000))
    || debts.some(d => !valid(d.balance, 0) || !valid(d.rate, 0, 1000) || !valid(d.annualPrincipal, 0))) return []
  let grossAssets = assets.reduce((sum, a) => sum + a.balance, 0)
  // Maintain the initial allocation by annual rebalancing. Zero initial assets use 0%.
  const returnRate = grossAssets ? assets.reduce((sum, a) => sum + a.balance * a.rate / 100, 0) / grossAssets : 0
  const balances = debts.map(d => d.balance)
  let fundingGap = 0, income = input.income, expense = input.expense
  const result: ProjectionYear[] = []
  for (let currentAge = age; currentAge <= 100; currentAge++) {
    const debt = balances.reduce((sum, b) => sum + b, 0)
    const interest = balances.reduce((sum, b, i) => sum + b * debts[i].rate / 100, 0)
    const payments = balances.map((b, i) => Math.min(b, debts[i].annualPrincipal))
    const principal = payments.reduce((sum, p) => sum + p, 0)
    const investmentReturn = grossAssets * returnRate
    const cashFlow = (currentAge >= retireAge ? 0 : income) - expense - interest - principal
    result.push({ age: currentAge, asset: grossAssets - debt - fundingGap, grossAssets, debt, fundingGap, interest, principal, cashFlow, investmentReturn })
    if (currentAge === 100) break
    // Year-end cash flows: a deficit is disclosed, never given an investment return.
    const available = grossAssets + investmentReturn + cashFlow - fundingGap
    grossAssets = Math.max(0, available)
    fundingGap = Math.max(0, -available)
    balances.forEach((b, i) => { balances[i] = b - payments[i] })
    income *= 1 + incomeGrowth / 100
    expense *= 1 + expenseGrowth / 100
    if (![grossAssets, fundingGap, income, expense].every(Number.isFinite)) return []
  }
  return result
}
