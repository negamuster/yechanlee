type Entry = { data: unknown; receivedAt: number }
const entries = new Map<string, Entry>()
const pending = new Map<string, Promise<unknown>>()
const MAX_AGE = 6 * 60 * 60 * 1000
export function cachedResource<T>(key: string): { data: T; receivedAt: number } | null {
  const entry = entries.get(key)
  if (!entry || Date.now() - entry.receivedAt > MAX_AGE) return null
  return entry as { data: T; receivedAt: number }
}
export async function loadResource<T>(key: string, valid: (data: unknown) => data is T, ttl: number, force = false): Promise<T> {
  const cached = cachedResource<T>(key)
  if (!force && cached && Date.now() - cached.receivedAt < ttl) return cached.data
  const existing = pending.get(key)
  if (existing) return existing as Promise<T>
  const request = (async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 25000)
    try {
      const response = await fetch(key, { signal: controller.signal })
      if (!response.ok) throw new Error('Data unavailable')
      const data: unknown = await response.json()
      if (!valid(data)) throw new Error('Invalid data')
      entries.delete(key)
      entries.set(key, { data, receivedAt: Date.now() })
      if (entries.size > 80) entries.delete(entries.keys().next().value!)
      return data
    } finally { clearTimeout(timer) }
  })()
  pending.set(key, request)
  try { return await request } finally { pending.delete(key) }
}
