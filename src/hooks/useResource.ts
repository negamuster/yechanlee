import { useEffect, useRef, useState } from 'react'
import { cachedResource, loadResource } from '../utils/resourceCache'

export function useResource<T>(key: string, valid: (data: unknown) => data is T, ttl: number, revision: number) {
  const [state, setState] = useState<{ key: string; revision: number; data: T | null; error: boolean }>({ key: '', revision: -1, data: null, error: false })
  const lastRevision = useRef(revision)
  useEffect(() => {
    let active = true
    const force = lastRevision.current !== revision
    lastRevision.current = revision
    void loadResource(key, valid, ttl, force).then(data => {
      if (active) setState({ key, revision, data, error: false })
    }).catch(() => {
      if (active) setState({ key, revision, data: cachedResource<T>(key)?.data ?? null, error: true })
    })
    return () => { active = false }
  }, [key, valid, ttl, revision])
  const current = state.key === key && state.revision === revision
  // Keep the same request's last data visible, never another date's events.
  return {
    data: state.key === key ? state.data : cachedResource<T>(key)?.data ?? null,
    loading: !current,
    error: current && state.error,
  }
}
