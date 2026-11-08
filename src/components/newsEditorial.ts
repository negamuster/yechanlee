import { filterNews } from './newsSelection.ts'
import type { NewsItem, Region } from './newsSelection.ts'

export type NewsOrder = 'major' | 'latest'
// Observable headline signals, not a prediction of returns or an assertion
// that the full article has been verified. No publisher prestige bonus.
export function newsPriority(item: NewsItem, now: number) {
  const signals: [string, RegExp, number][] = [
    ['통화정책·경제지표', /기준금리|연준|한국은행|중앙은행|소비자물가|고용보고서|비농업|국내총생산|\b(?:fed|fomc|ecb|boj|cpi|pce|gdp|payrolls|central bank|interest rate)\b/i, 8],
    ['기업 실적·주요 변화', /실적|영업이익|가이던스|인수합병|거래정지|상장폐지|\b(?:earnings|guidance|merger|acquisition|trading halt|delisting)\b/i, 7],
    ['정책·시장 변화', /관세|수출규제|국채|환율|공급망|\b(?:tariffs?|sanctions?|treasury|treasuries|supply chain)\b/i, 6],
  ]
  const signal = signals.find(([, pattern]) => pattern.test(item.title))
  const age = Math.max(0, (now - Date.parse(item.published_utc)) / 3600000)
  const freshness = Math.max(0, 4 - age / 6)
  return { score: (signal?.[2] ?? 0) + freshness - (item.feedStale ? 2 : 0), reason: signal?.[0] }
}
const stop = new Set(['the', 'and', 'that', 'this', 'are', 'has', 'have', 'says', 'said'])
function tokens(title: string) {
  return new Set((title.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(t => t.length > 0 && !stop.has(t)))
}
// Deliberately conservative, same-language headline grouping. Numbers and
// update markers protect changed forecasts, corrections and follow-up events.
export function sameNewsEvent(a: NewsItem, b: NewsItem) {
  if (Math.abs(Date.parse(a.published_utc) - Date.parse(b.published_utc)) > 12 * 3600000) return false
  if (/정정|속보|후속|업데이트|\b(?:correction|updated?|follow-up)\b/i.test(a.title + ' ' + b.title)) return false
  const numbers = (s: string) => (s.match(/\d+(?:[.,]\d+)*%?/g) || []).sort().join('|')
  if (numbers(a.title) !== numbers(b.title)) return false
  const x = tokens(a.title), y = tokens(b.title)
  const common = [...x].filter(t => y.has(t)).length
  const reporting = new Set(['announces', 'announced', 'announce', 'reports', 'reported', 'report', '발표', '밝혔다', '밝혀'])
  const unmatched = [...x].filter(t => !y.has(t)).concat([...y].filter(t => !x.has(t)))
  const core = (title: string) => [...tokens(title)].filter(t => !reporting.has(t)).join('|')
  return core(a.title) === core(b.title) && common >= 4 && common / (x.size + y.size - common) >= 0.72 && unmatched.every(t => reporting.has(t))
}
export function editorialBatches(items: NewsItem[], region: Region, now: number, order: NewsOrder): NewsItem[][] {
  const eligible = [...new Map(filterNews(items, region, 'all', '', now).map(item => [item.article_url, item])).values()]
    .sort((a, b) => Date.parse(b.published_utc) - Date.parse(a.published_utc) || a.id.localeCompare(b.id))
  const remaining: NewsItem[] = []
  for (const item of eligible) {
    const group = order === 'major' ? remaining.find(head => sameNewsEvent(head, item) && (head.related || []).every(other => sameNewsEvent(other, item))) : undefined
    if (group) group.related!.push(item)
    else remaining.push({ ...item, related: [], selectionReason: order === 'major' ? newsPriority(item, now).reason : undefined })
  }
  const batches: NewsItem[][] = []
  while (remaining.length) {
    const batch: NewsItem[] = [], counts = new Map<string, number>()
    while (remaining.length && batch.length < 12) {
      if (order === 'major') remaining.sort((a, b) => {
        const score = (item: NewsItem) => newsPriority(item, now).score - (counts.get(item.publisher) || 0) * 3
        return score(b) - score(a) || Date.parse(b.published_utc) - Date.parse(a.published_utc) || a.id.localeCompare(b.id)
      })
      const item = remaining.shift()!
      batch.push(item)
      counts.set(item.publisher, (counts.get(item.publisher) || 0) + 1)
    }
    batches.push(batch)
  }
  return batches
}
