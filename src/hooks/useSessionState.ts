import { useEffect, useState } from 'react'
const memory = new Map<string, unknown>()

export function useSessionState<T>(key: string, initial: T | (() => T), valid: (value: unknown) => boolean) {
  const storageKey = `anthracite.ui.v1.${key}`
  const [value, setValue] = useState<T>(() => {
    if (memory.has(storageKey) && valid(memory.get(storageKey))) return memory.get(storageKey) as T
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
      if (valid(saved)) return saved as T
    } catch { /* Continue with this tab's memory when storage is blocked. */ }
    return typeof initial === 'function' ? (initial as () => T)() : initial
  })
  useEffect(() => {
    memory.set(storageKey, value)
    try { sessionStorage.setItem(storageKey, JSON.stringify(value)) } catch { /* Optional storage. */ }
  }, [storageKey, value])
  return [value, setValue] as const
}
