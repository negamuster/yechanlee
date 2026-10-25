import { useEffect, useMemo, useState } from 'react'
import { cachedSearch, searchStocks } from '../lib/stockSearch'
import type { StockMatch } from '../lib/stockSearch'

const empty: StockMatch[] = []
export function useStockMatches(query: string, enabled: boolean) {
  const request = useMemo(() => ({ query, enabled }), [query, enabled])
  const cached = useMemo(() => enabled ? cachedSearch(query) : undefined, [query, enabled])
  const invalid = query.length > 60 || !/^[\p{L}\p{N} .&':-]+$/u.test(query)
  const eligible = enabled && !!query && !invalid
  const [response, setResponse] = useState<{ request: typeof request; stocks: StockMatch[]; failed: boolean }>()
  const current = response?.request === request ? response : undefined
  const stocks = eligible ? cached ?? current?.stocks ?? empty : empty
  const pending = eligible && cached === undefined && !current
  useEffect(() => {
    if (!eligible || cached !== undefined) return
    const controller = new AbortController()
    let active = true, timeout: number | undefined
    const timer = window.setTimeout(async () => {
      timeout = window.setTimeout(() => controller.abort(), 10000)
      try {
        const stocks = await searchStocks(query, controller.signal)
        if (active) setResponse({ request, stocks, failed: false })
      } catch { if (active) setResponse({ request, stocks: empty, failed: true }) }
      finally { window.clearTimeout(timeout) }
    }, 350)
    return () => { active = false; controller.abort(); window.clearTimeout(timer); window.clearTimeout(timeout) }
  }, [request, query, eligible, cached])
  return { stocks, pending, failed: eligible && !!current?.failed, invalid, ready: eligible && !pending }
}
