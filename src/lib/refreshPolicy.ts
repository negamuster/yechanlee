export interface RefreshPolicy { staleTime: number; interval: number }
const minute = 60000
// Freshness controls return/reconnect checks; cadence controls foreground polling.
export const refreshPolicies = {
  markets: { staleTime: minute, interval: minute },
  maps: { staleTime: 5 * minute, interval: 5 * minute },
  movers: { staleTime: 5 * minute, interval: 30 * minute },
  calendar: { staleTime: 5 * minute, interval: 15 * minute },
  news: { staleTime: 10 * minute, interval: 10 * minute },
  stock: { staleTime: 5 * minute, interval: 5 * minute },
  watchlist: { staleTime: 2 * minute, interval: 2 * minute },
  filings: { staleTime: 15 * minute, interval: 15 * minute },
} satisfies Record<string, RefreshPolicy>

export function needsRefresh(receivedAt: number | null | undefined, staleTime: number, now = Date.now()) {
  return receivedAt == null || !Number.isFinite(receivedAt) || now < receivedAt || now - receivedAt >= staleTime
}

export function refreshAvailable() {
  return typeof document === 'undefined' || (!document.hidden && (typeof navigator === 'undefined' || navigator.onLine !== false))
}

export function observeRefresh(policy: RefreshPolicy, receivedAt: () => number | null | undefined, refresh: () => void) {
  let lastAttempt = -Infinity
  const check = () => {
    const now = Date.now()
    if (!refreshAvailable() || !needsRefresh(receivedAt(), policy.staleTime, now)) return
    // Focus, visibility and online often arrive together. Failed requests must not
    // turn these events into a rapid retry loop either.
    if (now >= lastAttempt && now - lastAttempt < Math.min(30000, policy.interval)) return
    lastAttempt = now
    refresh()
  }
  const timer = window.setInterval(check, policy.interval)
  document.addEventListener('visibilitychange', check)
  window.addEventListener('focus', check)
  window.addEventListener('online', check)
  return () => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', check)
    window.removeEventListener('focus', check)
    window.removeEventListener('online', check)
  }
}
