export interface FinancialSource {
  accession: string; form: string; filing_date: string; start_date?: string; end_date: string;
  tag: string; value: number; unit: string; url: string; revised: boolean
}
export interface FinancialValue {
  value: number; unit: string; label?: string;
  basis?: 'ppe' | 'productive_assets';
  calculation?: 'difference' | 'sum' | 'ocf_minus_capex'; sources?: FinancialSource[]
}
export interface FinancialPeriod {
  start_date: string; end_date: string; filing_date: string; fiscal_period: 'FY' | 'Q' | 'TTM';
  accounting_standard: string; source_filing_url: string; form?: string; amended?: boolean; calculated?: boolean;
  financials: { income_statement: Record<string, FinancialValue | undefined>; balance_sheet: Record<string, FinancialValue | undefined>; cash_flow_statement?: Record<string, FinancialValue | undefined> }
}
export const financialMetrics = [
  { key: 'revenues', label: '매출', statement: 'income_statement' },
  { key: 'operating_income_loss', label: '영업이익', statement: 'income_statement' },
  { key: 'operating_cash_flow', label: '영업현금흐름', statement: 'cash_flow_statement' },
  { key: 'capital_expenditures', label: 'Capex', statement: 'cash_flow_statement' },
  { key: 'free_cash_flow', label: 'FCF', statement: 'cash_flow_statement' },
] as const
export type FinancialMetric = typeof financialMetrics[number]
export const financialBasis = (basis?: string) => basis === 'productive_assets' ? '생산자산 취득 총액' : basis === 'ppe' ? '유형자산 취득' : ''
export function financialValue(row: FinancialPeriod, metric: FinancialMetric) { return row.financials[metric.statement]?.[metric.key] }
export const financialDate = (date: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00Z`))
