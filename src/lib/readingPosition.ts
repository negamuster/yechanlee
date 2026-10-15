export interface ReadingPosition {
  y: number
  anchor?: { key: string; offset: number }
  focus?: string
  panels: Record<string, { top: number; left: number }>
}
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>
const STORAGE_KEY = 'anthracite.reading.v2'
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 3000
function valid(value: unknown): value is ReadingPosition {
  const p = value as ReadingPosition | null
  return !!p && finite(p.y) && p.y >= 0 && p.y <= 1e7
    && (!p.anchor || (text(p.anchor.key) && finite(p.anchor.offset) && Math.abs(p.anchor.offset) <= 1e7))
    && (!p.focus || text(p.focus)) && !!p.panels && typeof p.panels === 'object' && !Array.isArray(p.panels)
    && Object.entries(p.panels).length <= 30 && Object.entries(p.panels).every(([key, point]) => text(key) && point && finite(point.top) && point.top >= 0 && finite(point.left) && point.left >= 0)
}
export const topPosition = (): ReadingPosition => ({ y: 0, panels: {} })
export function createReadingStore(storage: StorageLike) {
  const entries = new Map<string, ReadingPosition>()
  try {
    const saved: unknown = JSON.parse(storage.getItem(STORAGE_KEY) || 'null')
    if (Array.isArray(saved)) for (const entry of saved.slice(-160)) {
      if (Array.isArray(entry) && text(entry[0]) && valid(entry[1])) entries.set(entry[0], entry[1])
    }
  } catch { /* Reading positions also work in memory when storage is blocked. */ }
  return {
    get: (key: string) => entries.get(key),
    set(key: string, position: ReadingPosition) {
      if (!text(key) || !valid(position)) return
      entries.delete(key); entries.set(key, position)
      while (entries.size > 160) entries.delete(entries.keys().next().value!)
      try { storage.setItem(STORAGE_KEY, JSON.stringify([...entries])) } catch { /* Retain this tab's in-memory position. */ }
    },
  }
}
export function readingKeys(layout: string, entry: string, path: string) {
  return { entry: `${layout}:entry:${entry}:${path}`, route: `${layout}:route:${path}` }
}
export function resumesList(pathname: string) {
  return ['/', '/markets', '/saved', '/briefings'].includes(pathname)
}
export function findReadingTarget(store: Pick<ReturnType<typeof createReadingStore>, 'get'>, layout: string, location: { key: string; pathname: string; search: string; hash?: string; state?: unknown }, navigation: string) {
  const keys = readingKeys(layout, location.key, location.pathname + location.search)
  const restoreEntry = (location.state as { restoreEntry?: unknown } | null)?.restoreEntry
  const exact = navigation === 'POP' ? store.get(keys.entry) : typeof restoreEntry === 'string' ? store.get(readingKeys(layout, restoreEntry, location.pathname + location.search).entry) : undefined
  return { position: exact ?? (resumesList(location.pathname) ? store.get(keys.route) : undefined) ?? topPosition(), hash: exact ? '' : location.hash ?? '' }
}
export interface ReadingEnvironment {
  capture(): ReadingPosition
  restore(position: ReadingPosition): void
  followHash(hash: string): boolean
  observe(callback: () => void): () => void
  onScroll(callback: () => void): () => void
  onInteraction(callback: () => void): () => void
  onExit(callback: () => void): () => void
  deadline(callback: () => void, milliseconds: number): () => void
}
// Keep the intended position while async lists and images arrive. User input always wins.
export function maintainReadingPosition(target: ReadingPosition, hash: string, env: ReadingEnvironment, save: (value: ReadingPosition) => void) {
  let restoring = true
  let current = target
  const remember = () => { if (!restoring) current = env.capture() }
  const stop = () => { if (restoring) { restoring = false; current = env.capture() } }
  const attempt = () => {
    if (!restoring) return
    if (hash) { if (env.followHash(hash)) stop(); return }
    env.restore(target)
  }
  const cleanup = [env.observe(attempt), env.onScroll(remember), env.onInteraction(stop), env.onExit(() => { remember(); save(current) }), env.deadline(stop, 32000)]
  attempt()
  if (!hash && target.y === 0 && !target.anchor && !Object.values(target.panels).some(p => p.top || p.left)) stop()
  return () => { save(current); cleanup.forEach(dispose => dispose()) }
}
