import { useEffect, useRef, useState } from 'react'
import { fetchStockSnapshot, freshSnapshot, usableSnapshot, StockSnapshotError } from '../lib/stockSnapshot'
import type { StockSnapshot } from '../lib/stockSnapshot'
import { useRefreshSchedule } from './useRefreshSchedule'
import { refreshAvailable, refreshPolicies } from '../lib/refreshPolicy'

const cache = new Map<string, StockSnapshot>()
export function useStockSnapshot(symbol: string) {
  const [snapshot, setSnapshot] = useState<StockSnapshot>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const force = useRef(false)
  const refresh = () => { force.current = true; setRevision(n => n + 1) }
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const cached = cache.get(symbol)
    const usable = usableSnapshot(cached, symbol)
    setSnapshot(usable ? cached : undefined)
    setError('')
    const shouldFetch = force.current || refreshAvailable() && !freshSnapshot(cached, symbol)
    force.current = false
    setLoading(shouldFetch)
    const timer = window.setTimeout(() => controller.abort(), 30000)
    if (shouldFetch) void fetchStockSnapshot(symbol, controller.signal).then(data => {
      if (!active) return
      if (!data.financialSource && data.issues.includes('연간 재무') && usable && cached?.financials.length && cached.financialSource) {
        data = { ...data, financials: cached.financials, financialSource: { ...cached.financialSource, stale: true } }
      }
      if (cache.size >= 50) cache.delete(cache.keys().next().value!)
      cache.set(symbol, data); setSnapshot(data)
    }).catch(error => {
      if (!active) return
      setError(usable ? '갱신 실패 · 이전 조회 자료를 표시합니다.' : error instanceof StockSnapshotError ? error.message : '종목 조회가 중단되었거나 연결에 실패했습니다. 잠시 후 다시 조회해 주세요.')
    }).finally(() => { window.clearTimeout(timer); if (active) setLoading(false) })
    else window.clearTimeout(timer)
    return () => { active = false; controller.abort(); window.clearTimeout(timer) }
  }, [symbol, revision])
  useRefreshSchedule(refreshPolicies.stock, () => cache.get(symbol)?.fetchedAt, () => setRevision(n => n + 1), symbol)
  // Never expose the previous symbol during the render before effect cleanup.
  return { snapshot: snapshot?.symbol === symbol ? snapshot : undefined, loading: loading || snapshot?.symbol !== symbol && !error, error, refresh }
}
