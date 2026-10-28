import { useEffect, useRef } from 'react'
import { observeRefresh } from '../lib/refreshPolicy'
import type { RefreshPolicy } from '../lib/refreshPolicy'

export function useRefreshSchedule(policy: RefreshPolicy, receivedAt: () => number | null | undefined, refresh: () => void, key = '', enabled = true) {
  const latest = useRef({ receivedAt, refresh })
  useEffect(() => { latest.current = { receivedAt, refresh } })
  useEffect(() => enabled ? observeRefresh(policy, () => latest.current.receivedAt(), () => latest.current.refresh()) : undefined, [policy, key, enabled])
}
