import { filterNews } from '../components/newsSelection.ts'
import type { NewsItem, Region, TopicFilter } from '../components/newsSelection.ts'
import { matchesSector } from '../components/sectorNews.ts'
import type { NewsSector } from '../components/sectorNews.ts'

export interface NewsFilters {
  region: Region
  topic: TopicFilter
  query: string
  sector: NewsSector | null
  hideRead: boolean
  view: 'cards' | 'list'
}
export function defaultNewsFilters(view: NewsFilters['view']): NewsFilters {
  return { region: 'all', topic: 'all', query: '', sector: null, hideRead: false, view }
}
export function countNewsFilters(filters: NewsFilters) {
  return Number(filters.region !== 'all') + Number(filters.topic !== 'all')
    + Number(Boolean(filters.query.trim())) + Number(Boolean(filters.sector)) + Number(filters.hideRead)
}
export function matchingNews(items: NewsItem[], filters: NewsFilters, isRead: (url: string) => boolean, now = Date.now()) {
  return filterNews(items, filters.region, filters.topic, filters.query, now)
    .filter(item => matchesSector(item.title, filters.sector?.symbol ?? null) && (!filters.hideRead || !isRead(item.article_url)))
}
