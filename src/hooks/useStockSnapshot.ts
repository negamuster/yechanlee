import { useEffect, useRef, useState } from 'react'
import { fetchStockSnapshot, freshSnapshot, usableSnapshot, STOCK_TTL } from '../lib/stockSnapshot'
import type { StockSnapshot } from '../lib/stockSnapshot'

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
    const shouldFetch = force.current || !freshSnapshot(cached, symbol)
    force.current = false
    setLoading(shouldFetch)
    const timer = window.setTimeout(() => controller.abort(), 30000)
    if (shouldFetch) void fetchStockSnapshot(symbol, controller.signal).then(data => {
      if (!active) return
      if (cache.size >= 50) cache.delete(cache.keys().next().value!)
      cache.set(symbol, data); setSnapshot(data)
    }).catch(() => {
      if (!active) return
      setError(usable ? '갱신 실패 · 이전 조회 자료를 표시합니다.' : '종목 데이터를 불러오지 못했습니다. 티커와 데이터 제공 상태를 확인한 뒤 다시 시도해 주세요.')
    }).finally(() => { window.clearTimeout(timer); if (active) setLoading(false) })
    else window.clearTimeout(timer)
    return () => { active = false; controller.abort(); window.clearTimeout(timer) }
  }, [symbol, revision])
  useEffect(() => {
    const check = () => { if (!document.hidden && !freshSnapshot(cache.get(symbol), symbol)) setRevision(n => n + 1) }
    const timer = window.setInterval(check, STOCK_TTL)
    document.addEventListener('visibilitychange', check)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', check) }
  }, [symbol])
  // Never expose the previous symbol during the render before effect cleanup.
  return { snapshot: snapshot?.symbol === symbol ? snapshot : undefined, loading: loading || snapshot?.symbol !== symbol && !error, error, refresh }
}
