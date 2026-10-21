import { refreshPolicies } from './refreshPolicy.ts'
import { TOPICS } from '../components/newsSelection.ts'
import type { NewsItem } from '../components/newsSelection.ts'
import { matchingNews } from './newsFilters.ts'
import type { NewsFilters } from './newsFilters.ts'
import { readUrl } from './readArticles.ts'

export interface NewsFeedData {
  items: NewsItem[]
  fetchedAt: number
  sources: { id: string; publisher: string; region: string; status: string; error?: string; checkedAt?: number | null; lastSuccessAt?: number; nextRetryAt?: number; eligibleItems?: number; latestPublishedAt?: string | null }[]
}
export interface NewsSnapshot {
  current: NewsFeedData | null
  latest: NewsFeedData | null
  selectedAt: number
}
export const NEWS_SNAPSHOT_KEY = 'anthracite_news_snapshot_v1'
export const NEWS_REFRESH_INTERVAL = refreshPolicies.news.interval
const MAX_AGE = 6 * 60 * 60 * 1000

export function isNewsFeed(value: unknown, now = Date.now()): value is NewsFeedData {
  if (!value || typeof value !== 'object') return false
  const data = value as NewsFeedData
  return Number.isFinite(data.fetchedAt) && data.fetchedAt <= now + 300000
    && Array.isArray(data.sources) && data.sources.every(source => source && typeof source.publisher === 'string' && typeof source.status === 'string')
    && Array.isArray(data.items) && data.items.every(item => item && typeof item.id === 'string'
      && typeof item.title === 'string' && typeof item.publisher === 'string' && typeof item.article_url === 'string' && !!readUrl(item.article_url)
      && (item.image_url === undefined || typeof item.image_url === 'string' && item.image_url.startsWith('https://'))
      && (item.image_credit === undefined || typeof item.image_credit === 'string')
      && Array.isArray(item.topics) && item.topics.length > 0 && item.topics.every(topic => TOPICS.some(known => known.value === topic))
      && ['kr', 'global'].includes(item.region) && Number.isFinite(Date.parse(item.published_utc)))
}

// Publisher IDs and fragments can change while the article itself stays the same.
export const newsIdentity = (item: NewsItem) => readUrl(item.article_url)
function uniqueFeed(feed: NewsFeedData): NewsFeedData {
  const seen = new Set<string>()
  return { ...feed, items: feed.items.filter(item => {
    const key = newsIdentity(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }) }
}

export function readNewsSnapshot(storage: Pick<Storage, 'getItem'> | null, now = Date.now()): NewsSnapshot {
  const empty = { current: null, latest: null, selectedAt: now }
  const fresh = (feed: unknown): feed is NewsFeedData => isNewsFeed(feed, now) && now - feed.fetchedAt < MAX_AGE
  try {
    const saved = JSON.parse(storage?.getItem(NEWS_SNAPSHOT_KEY) || 'null') as NewsSnapshot | null
    if (saved && fresh(saved.current)) {
      const current = uniqueFeed(saved.current)
      const latest = fresh(saved.latest) && saved.latest.fetchedAt >= current.fetchedAt ? uniqueFeed(saved.latest) : current
      const selectedAt = Number.isFinite(saved.selectedAt) && saved.selectedAt <= now && saved.selectedAt >= now - MAX_AGE ? saved.selectedAt : now
      return { current, latest, selectedAt }
    }
    // An expired reading snapshot may be replaced when opening the page again.
    if (saved && fresh(saved.latest)) { const feed = uniqueFeed(saved.latest); return { current: feed, latest: feed, selectedAt: now } }
    const legacy: unknown = JSON.parse(storage?.getItem('anthracite_curated_news_v6') || 'null')
    if (fresh(legacy)) { const feed = uniqueFeed(legacy); return { current: feed, latest: feed, selectedAt: now } }
  } catch { /* News still works without persistent storage. */ }
  return empty
}

export function receiveNewsSnapshot(state: NewsSnapshot, incoming: NewsFeedData, now = Date.now()): NewsSnapshot {
  if (state.latest && incoming.fetchedAt < state.latest.fetchedAt) return state
  const latest = uniqueFeed(incoming)
  // There is no article position to preserve before the first non-empty list.
  return !state.current?.items.length ? { current: latest, latest, selectedAt: now } : { ...state, latest }
}
export function applyNewsSnapshot(state: NewsSnapshot, now = Date.now()): NewsSnapshot {
  return state.latest ? { current: state.latest, latest: state.latest, selectedAt: now } : state
}

function fingerprint(item: NewsItem) {
  return JSON.stringify([item.title, item.published_utc, item.publisher, item.region, item.topics,
    item.image_url, item.image_credit, Boolean(item.feedStale)])
}
export function newsUpdateSummary(state: NewsSnapshot, filters: NewsFilters, isRead: (url: string) => boolean, now = Date.now()) {
  if (!state.current || !state.latest || state.current === state.latest) return { count: 0, available: false }
  const current = new Map(matchingNews(state.current.items, filters, isRead, state.selectedAt).map(item => [newsIdentity(item), fingerprint(item)]))
  const latest = new Map(matchingNews(state.latest.items, filters, isRead, now).map(item => [newsIdentity(item), fingerprint(item)]))
  const count = [...latest.keys()].filter(key => !current.has(key)).length
  return { count, available: current.size !== latest.size || [...latest].some(([key, value]) => current.get(key) !== value) }
}
