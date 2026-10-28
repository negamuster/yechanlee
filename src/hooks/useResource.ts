import { useEffect, useRef, useState } from 'react'
import { cachedResource, loadResource, subscribeResource } from '../utils/resourceCache'
import { refreshAvailable } from '../lib/refreshPolicy'
import type { RefreshPolicy } from '../lib/refreshPolicy'
import { useRefreshSchedule } from './useRefreshSchedule'

export function useResource<T>(key: string, valid: (data: unknown) => data is T, policy: RefreshPolicy, revision: number, enabled = true) {
  const [state, setState] = useState<{ key: string; revision: number; data: T | null; error: boolean }>({ key: '', revision: -1, data: null, error: false })
  const [automatic, setAutomatic] = useState(0)
  const lastRevision = useRef(revision)
  useRefreshSchedule(policy, () => cachedResource(key)?.receivedAt, () => setAutomatic(n => n + 1), key, enabled)
  useEffect(() => !enabled ? undefined : subscribeResource(key, () => {
    const cached = cachedResource<T>(key)
    if (cached && valid(cached.data)) setState({ key, revision, data: cached.data, error: false })
  }), [key, valid, revision, enabled])
  useEffect(() => {
    let active = true
    if (!enabled) return
    const force = lastRevision.current !== revision
    lastRevision.current = revision
    if (!force && !refreshAvailable()) return
    void loadResource(key, valid, policy.staleTime, force).then(data => {
      if (active) setState({ key, revision, data, error: false })
    }).catch(() => {
      if (active) setState(previous => ({ key, revision, data: cachedResource<T>(key)?.data ?? (previous.key === key ? previous.data : null), error: true }))
    })
    return () => { active = false }
  }, [key, valid, policy, revision, automatic, enabled])
  const current = state.key === key && state.revision === revision
  // Keep the same request's last data visible, never another date's events.
  return {
    data: !enabled ? null : state.key === key ? state.data : cachedResource<T>(key)?.data ?? null,
    loading: enabled && !current,
    error: enabled && current && state.error,
  }
}
