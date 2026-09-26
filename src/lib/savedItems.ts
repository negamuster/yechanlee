export const SAVED_KEY = 'anthracite:saved:v1'
export interface SavedStock { ticker: string; name: string }
export interface SavedArticle { article_url: string; title: string; publisher: string; published_utc: string }
export interface SavedItems { version: 1; stocks: SavedStock[]; articles: SavedArticle[] }
export const emptySaved = (): SavedItems => ({ version: 1, stocks: [], articles: [] })
export function articleKey(value: string): string {
  try { const url = new URL(value); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return ''; url.hash = ''; return url.href } catch { return '' }
}
function short(value: unknown, max: number): value is string { return typeof value === 'string' && value.length > 0 && value.length <= max }
export function parseSaved(raw: string | null): SavedItems {
  if (!raw) return emptySaved()
  const data = JSON.parse(raw)
  if (data?.version !== 1 || !Array.isArray(data.stocks) || !Array.isArray(data.articles)) throw new Error('invalid storage')
  const stocks = new Map<string, SavedStock>(), articles = new Map<string, SavedArticle>()
  for (const row of data.stocks) if (row && short(row.ticker, 20) && /^[A-Z0-9][A-Z0-9.-]*$/.test(row.ticker) && short(row.name, 300)) stocks.set(row.ticker, { ticker: row.ticker, name: row.name })
  for (const row of data.articles) if (row && short(row.article_url, 4000) && articleKey(row.article_url) && short(row.title, 1000) && short(row.publisher, 200) && short(row.published_utc, 50) && Number.isFinite(Date.parse(row.published_utc))) {
    const key = articleKey(row.article_url)
    articles.set(key, { article_url: key, title: row.title, publisher: row.publisher, published_utc: row.published_utc })
  }
  return { version: 1, stocks: [...stocks.values()], articles: [...articles.values()] }
}
// Read before each change so sequential changes from another tab are preserved.
// Only report success after the browser has accepted the write.
export function updateSaved(storage: Pick<Storage, 'getItem' | 'setItem'>, change: (value: SavedItems) => SavedItems): SavedItems {
  const next = parseSaved(JSON.stringify(change(parseSaved(storage.getItem(SAVED_KEY)))))
  if (next.stocks.length > 200 || next.articles.length > 500) throw new Error('limit')
  storage.setItem(SAVED_KEY, JSON.stringify(next))
  return next
}
