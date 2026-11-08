import { filterNews } from './newsSelection.ts'
import type { NewsItem, Region } from './newsSelection.ts'

export type NewsOrder = 'major' | 'latest'
// Observable headline signals, not a prediction of returns or an assertion
// that the full article has been verified. No publisher prestige bonus.
export function articleKind(title: string): NonNullable<NewsItem['articleKind']> {
  const speculative = /애널리스트|증권사|목표주가|예상|가능성|할\s*듯|\b(?:analysts?|expects?|expected|could|may|might|likely)\b/i.test(title)
  const guidanceChange = /(?:실적|매출|이익|연간).*전망.*(?:상향|하향|철회)|(?:가이던스).*(?:상향|하향|철회)|\b(?:raises?|cuts?|withdraws?|lifts?|lowers?|boosts?)\b.{0,45}\b(?:guidance|outlook)\b/i.test(title)
  if (guidanceChange && !speculative) return '보도·일반'
  if (/칼럼|사설|기고|\b(?:opinion|editorial|commentary|analysis|why|how to|ways)\b/i.test(title)) return '해설·의견'
  if (/주간|전망|주시|주목|예고|\b(?:preview|outlook|week ahead|could|likely|sees|braces|set to)\b/i.test(title)) return '전망·예고'
  return '보도·일반'
}
export function newsPriority(item: NewsItem, now: number) {
  const signals: [string, string, RegExp, number][] = [
    ['inflation', '물가·경제지표', /소비자물가|생산자물가|인플레이션|\b(?:cpi|pce|ppi|inflation)\b/i, 8],
    ['employment', '고용·경제지표', /고용보고서|비농업|실업률|구인|\b(?:payrolls|unemployment|jolts|jobs report)\b/i, 8],
    ['growth', '성장·경제지표', /국내총생산|\b(?:gdp|gross domestic product)\b/i, 8],
    ['monetary', '통화정책·경제지표', /기준금리|연준|한국은행|중앙은행|\b(?:fed|fomc|ecb|boj|central bank|interest rates?)\b/i, 8],
    ['corporate', '기업 실적·주요 변화', /실적|영업이익|가이던스|인수합병|거래정지|상장폐지|\b(?:earnings|guidance|merger|acquisition|trading halt|delisting)\b/i, 7],
    ['policy', '정책·시장 변화', /관세|수출규제|국채|환율|공급망|\b(?:tariffs?|sanctions?|treasury|treasuries|supply chain)\b/i, 6],
  ]
  const signal = signals.find(([, , pattern]) => pattern.test(item.title))
  const age = Math.max(0, (now - Date.parse(item.published_utc)) / 3600000)
  const kind = articleKind(item.title)
  const freshness = Math.max(0, 4 - age / 6) - Math.max(0, age - 24) / 12
  return { score: (signal?.[3] ?? 0) + freshness - (item.feedStale ? 2 : 0) - (kind === '보도·일반' ? 0 : 1.5),
    reason: signal?.[1], bucket: signal?.[0] ?? item.topics?.[0] ?? 'general', macro: !!signal && ['inflation', 'employment', 'growth', 'monetary'].includes(signal[0]) }
}
// Restrict semantic grouping to explicit central-bank policy decisions. Matching
// named institution, action, numeric/unit signatures and NY day are mandatory.
function policyDecision(title: string) {
  const text = title.normalize('NFKC').toLowerCase().replace(/[,.]$/, '').trim()
  // Entire headline must describe the decision itself. Commentary, forecasts,
  // negation and multi-clause reactions never enter this bilingual shortcut.
  const english = text.match(/^(?:the )?(?:us )?(fed|federal reserve|fomc|ecb|boj|bank of korea) (holds?|keeps?|leaves?|cuts?|lowers?|raises?|hikes?) (?:its )?(?:benchmark |policy |interest )?rates? (?:steady |unchanged )?(at|to) (\d+(?:\.\d+)?)\s*(?:%|percent|per cent)$/)
  const korean = text.match(/^(연준|연방준비제도|유럽중앙은행|일본은행|한국은행|한은)[,\s]*(?:기준)?금리(?:를)?\s*(\d+(?:\.\d+)?)\s*%(로)?\s*(동결|유지|인하|인상)$/)
  if (!english && !korean) return null
  const bank = english?.[1] ?? korean![1]
  const canonical = /^(fed|federal reserve|fomc|연준|연방준비제도)$/.test(bank) ? 'fed' : /^(ecb|유럽중앙은행)$/.test(bank) ? 'ecb' : /^(boj|일본은행)$/.test(bank) ? 'boj' : 'bok'
  const action = english?.[2] ?? korean![4]
  const direction = /^(hold|keep|leave)|동결|유지/.test(action) ? 'hold' : /^(cut|lower)|인하/.test(action) ? 'cut' : 'hike'
  if (english && english[3] !== (direction === 'hold' ? 'at' : 'to')) return null
  if (korean && direction !== 'hold' && !korean[3]) return null
  return `${canonical}:${direction}:${english?.[4] ?? korean![2]}%`
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
  const policyA = policyDecision(a.title), policyB = policyDecision(b.title)
  const nyDay = (item: NewsItem) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(Date.parse(item.published_utc))
  if (policyA && policyA === policyB && nyDay(a) === nyDay(b)) return true
  if (numbers(a.title) !== numbers(b.title)) return false
  const x = tokens(a.title), y = tokens(b.title)
  const common = [...x].filter(t => y.has(t)).length
  const reporting = new Set(['announces', 'announced', 'announce', 'reports', 'reported', 'report', '발표', '밝혔다', '밝혀'])
  const unmatched = [...x].filter(t => !y.has(t)).concat([...y].filter(t => !x.has(t)))
  const core = (title: string) => (title.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(t => !stop.has(t) && !reporting.has(t)).join('|')
  return core(a.title) === core(b.title) && common >= 4 && common / (x.size + y.size - common) >= 0.72 && unmatched.every(t => reporting.has(t))
}
export function editorialBatches(items: NewsItem[], region: Region, now: number, order: NewsOrder): NewsItem[][] {
  const eligible = [...new Map(filterNews(items, region, 'all', '', now).map(item => [item.article_url, item])).values()]
    .sort((a, b) => Date.parse(b.published_utc) - Date.parse(a.published_utc) || a.id.localeCompare(b.id))
  const remaining: NewsItem[] = []
  for (const item of eligible) {
    const group = order === 'major' ? remaining.find(head => sameNewsEvent(head, item) && (head.related || []).every(other => sameNewsEvent(other, item))) : undefined
    if (group) group.related!.push(item)
    else remaining.push({ ...item, articleKind: articleKind(item.title), related: [], selectionReason: order === 'major' ? newsPriority(item, now).reason : undefined })
  }
  const batches: NewsItem[][] = []
  while (remaining.length) {
    const batch: NewsItem[] = [], counts = new Map<string, number>(), topics = new Map<string, number>()
    let macroCount = 0
    while (remaining.length && batch.length < 12) {
      if (order === 'major') remaining.sort((a, b) => {
        const score = (item: NewsItem) => {
          const priority = newsPriority(item, now)
          return priority.score - (counts.get(item.publisher) || 0) * 3 - (topics.get(priority.bucket) || 0) * 3 - (priority.macro ? macroCount * 1.5 : 0)
        }
        return score(b) - score(a) || Date.parse(b.published_utc) - Date.parse(a.published_utc) || a.id.localeCompare(b.id)
      })
      const item = remaining.shift()!
      batch.push(item)
      counts.set(item.publisher, (counts.get(item.publisher) || 0) + 1)
      const priority = newsPriority(item, now)
      topics.set(priority.bucket, (topics.get(priority.bucket) || 0) + 1)
      if (priority.macro) macroCount++
    }
    batches.push(batch)
  }
  return batches
}
