export type Region = 'all' | 'global' | 'kr'
export const TOPICS = [
  { value: 'economy', label: '경제' }, { value: 'tech', label: '테크' },
  { value: 'investing', label: '투자' }, { value: 'business', label: '기업' },
] as const
export type Topic = typeof TOPICS[number]['value']
export type TopicFilter = 'all' | Topic
export interface NewsItem {
  id: string
  title: string
  article_url: string
  published_utc: string
  publisher: string
  region: Exclude<Region, 'all'>
  image_url?: string
  image_credit?: string
  topics?: Topic[]
}

export function filterNews(items: NewsItem[], region: Region, topic: TopicFilter, query = '', now = Date.now()): NewsItem[] {
  const terms = query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean)
  return items.filter(item => Number.isFinite(Date.parse(item.published_utc))
    && now - Date.parse(item.published_utc) <= 72 * 60 * 60 * 1000
    && Date.parse(item.published_utc) <= now + 300000
    && (region === 'all' || item.region === region)
    && (topic === 'all' || item.topics?.includes(topic))
    && terms.every(term => `${item.title} ${item.publisher}`.normalize('NFKC').toLocaleLowerCase().includes(term)))
}

export function selectNews(items: NewsItem[], region: Region, now = Date.now(), limit = 12): NewsItem[] {
  const pools = { global: new Map<string, NewsItem[]>(), kr: new Map<string, NewsItem[]>() }
  for (const item of [...items].sort((a, b) => Date.parse(b.published_utc) - Date.parse(a.published_utc))) {
    const timestamp = Date.parse(item.published_utc)
    if (!Number.isFinite(timestamp) || now - timestamp > 72 * 60 * 60 * 1000 || timestamp > now + 300000) continue
    const group = pools[item.region].get(item.publisher) || []
    if (group.length < 3) group.push(item)
    pools[item.region].set(item.publisher, group)
  }
  const selected: NewsItem[] = []
  // Give every available publisher one slot before taking its second article.
  for (let round = 0; round < 3 && selected.length < limit; round++) {
    const global = region === 'kr' ? [] : [...pools.global.values()].flatMap(group => group[round] ? [group[round]] : [])
    const kr = region === 'global' ? [] : [...pools.kr.values()].flatMap(group => group[round] ? [group[round]] : [])
    while ((global.length || kr.length) && selected.length < limit) {
      for (const queue of [global, kr]) {
        const item = queue.shift()
        if (item && selected.length < limit) selected.push(item)
      }
    }
  }
  return selected.sort((a, b) => Date.parse(b.published_utc) - Date.parse(a.published_utc))
}
