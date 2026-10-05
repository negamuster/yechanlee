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


export function exportSaved(items: SavedItems, now = new Date()) {
  return JSON.stringify({ app: 'Anthracite', backupVersion: 1, exportedAt: now.toISOString(), data: parseSaved(JSON.stringify(items)) }, null, 2)
}
export function importSaved(raw: string): SavedItems {
  if (new TextEncoder().encode(raw).length > 5 * 1024 * 1024) throw new Error('백업 파일은 5MB 이하만 불러올 수 있습니다.')
  let backup
  try { backup = JSON.parse(raw.replace(/^\uFEFF/, '')) } catch { throw new Error('JSON 백업 파일을 읽을 수 없습니다.') }
  if (backup?.app !== 'Anthracite' || backup.backupVersion !== 1 || backup.data?.version !== 1 || !Array.isArray(backup.data.stocks) || !Array.isArray(backup.data.articles)) throw new Error('지원되는 Anthracite 백업 파일이 아닙니다.')
  const data = backup.data
  if (data.stocks.length > 200 || data.articles.length > 500) throw new Error('백업의 항목 수가 저장 한도를 초과합니다.')
  // Reject a damaged file as a whole rather than silently dropping records.
  for (const stock of data.stocks) if (parseSaved(JSON.stringify({ version: 1, stocks: [stock], articles: [] })).stocks.length !== 1) throw new Error('백업에 올바르지 않은 종목이 있습니다.')
  for (const article of data.articles) if (parseSaved(JSON.stringify({ version: 1, stocks: [], articles: [article] })).articles.length !== 1) throw new Error('백업에 올바르지 않은 기사 또는 링크가 있습니다.')
  return parseSaved(JSON.stringify(data))
}
export function mergeSaved(current: SavedItems, imported: SavedItems): SavedItems {
  const stocks = new Set(current.stocks.map(s => s.ticker))
  const articles = new Set(current.articles.map(a => articleKey(a.article_url)))
  const merged: SavedItems = { version: 1, stocks: [...current.stocks, ...imported.stocks.filter(s => !stocks.has(s.ticker))], articles: [...current.articles, ...imported.articles.filter(a => !articles.has(articleKey(a.article_url)))] }
  if (merged.stocks.length > 200 || merged.articles.length > 500) throw new Error('합친 목록이 한도를 초과합니다. 관심 종목 200개·기사 500개 이내로 정리한 뒤 다시 불러와 주세요.')
  return merged
}
