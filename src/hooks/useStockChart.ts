import { useMemo } from 'react'
import { useResource } from './useResource'
import { refreshPolicies } from '../lib/refreshPolicy'
import { validStockChart } from '../lib/stockChart'
import type { StockChartData, StockChartPeriod } from '../lib/stockChart'
export function useStockChart(symbol: string, period: StockChartPeriod, revision: number) {
  const valid = useMemo(() => (value: unknown): value is StockChartData => validStockChart(value) && value.symbol === symbol && value.period === period, [symbol, period])
  return useResource(`/api/stock-chart?ticker=${encodeURIComponent(symbol)}&period=${period}`, valid, refreshPolicies.markets, revision)
}
