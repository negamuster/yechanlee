export const READ_KEY = 'anthracite:read:v1'
export type ReadArticles = Record<string, number>
const MAX_AGE = 90 * 86400000
export function readUrl(raw: string): string {
  try { const url = new URL(raw); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return ''; url.hash = ''; return url.href } catch { return '' }
}
export function parseRead(raw: string | null, now = Date.now()): ReadArticles {
  try {
    const data = JSON.parse(raw || '{}')
    if (!data || Array.isArray(data) || typeof data !== 'object') return {}
    return Object.fromEntries(Object.entries(data).filter(([url, time]) => readUrl(url) === url && typeof time === 'number' && Number.isFinite(time) && time <= now + 300000 && time >= now - MAX_AGE).sort((a,b) => Number(b[1]) - Number(a[1])).slice(0, 1000)) as ReadArticles
  } catch { return {} }
}
export function markRead(current: ReadArticles, url: string, now = Date.now()) {
  const key = readUrl(url)
  return key ? parseRead(JSON.stringify({ ...current, [key]: now }), now) : current
}
