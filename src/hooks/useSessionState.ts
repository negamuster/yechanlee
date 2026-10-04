import { useEffect, useState } from 'react'

export function useSessionState<T>(key: string, initial: T | (() => T), valid: (value: unknown) => boolean) {
  const storageKey = `anthracite.ui.v1.${key}`
  const [value, setValue] = useState<T>(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
      if (valid(saved)) return saved as T
    } catch { /* Private browsing or invalid stored data: use the default. */ }
    return typeof initial === 'function' ? (initial as () => T)() : initial
  })
  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(value)) } catch { /* Optional storage. */ }
  }, [storageKey, value])
  return [value, setValue] as const
}
