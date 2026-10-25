import { useEffect, useState } from 'react'
import { fetchStockSnapshot, freshSnapshot, usableSnapshot, StockSnapshotError, retainStockResources } from '../lib/stockSnapshot'
import type { StockSnapshot } from '../lib/stockSnapshot'
import { useRefreshSchedule } from './useRefreshSchedule'
import { refreshAvailable, refreshPolicies } from '../lib/refreshPolicy'

const cache = new Map<string, StockSnapshot>()
export function useStockSnapshot(symbol: string) {
  const [request, setRequest] = useState({ revision: 0, force: false })
  const [result, setResult] = useState<{ symbol: string; request: typeof request; snapshot?: StockSnapshot; error: string }>()
  const current = result?.symbol === symbol && result.request === request ? result : undefined
  const cached = cache.get(symbol)
  const snapshot = current?.snapshot ?? (usableSnapshot(cached, symbol) ? cached : undefined)
  const shouldFetch = request.force || refreshAvailable() && !freshSnapshot(cached, symbol)
  const loading = !current && shouldFetch
  const error = current?.error ?? ''
  const refresh = () => setRequest(previous => ({ revision: previous.revision + 1, force: true }))
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const cached = cache.get(symbol)
    const usable = usableSnapshot(cached, symbol)
    const shouldFetch = request.force || refreshAvailable() && !freshSnapshot(cached, symbol)
    const timer = window.setTimeout(() => controller.abort(), 30000)
    if (shouldFetch) void fetchStockSnapshot(symbol, controller.signal).then(data => {
      if (!active) return
      if (!data.financialSource && data.issues.includes('연간 재무') && usable && cached && (cached.financials.length || cached.quarterlyFinancials?.length) && cached.financialSource) {
        data = { ...data, financials: cached.financials, quarterlyFinancials: cached.quarterlyFinancials, ttmFinancials: cached.ttmFinancials, financialSource: { ...cached.financialSource, stale: true } }
      }
      data = retainStockResources(cached, data)
      if (cache.size >= 50) cache.delete(cache.keys().next().value!)
      cache.set(symbol, data); setResult({ symbol, request, snapshot: data, error: '' })
    }).catch(error => {
      if (!active) return
      setResult({ symbol, request, snapshot: usable ? cached : undefined, error: usable ? '갱신 실패 · 이전 조회 자료를 표시합니다.' : error instanceof StockSnapshotError ? error.message : '종목 조회가 중단되었거나 연결에 실패했습니다. 잠시 후 다시 조회해 주세요.' })
    }).finally(() => { window.clearTimeout(timer) })
    else window.clearTimeout(timer)
    return () => { active = false; controller.abort(); window.clearTimeout(timer) }
  }, [symbol, request])
  useRefreshSchedule(refreshPolicies.stock, () => cache.get(symbol)?.fetchedAt, () => setRequest(previous => ({ revision: previous.revision + 1, force: false })), symbol)
  // Never expose the previous symbol during the render before effect cleanup.
  return { snapshot: snapshot?.symbol === symbol ? snapshot : undefined, loading: loading || snapshot?.symbol !== symbol && !error, error, refresh }
}
