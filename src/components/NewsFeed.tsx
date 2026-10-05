import { dataTime } from '../utils/dataTime'
import { useSessionState } from '../hooks/useSessionState'
import { BookmarkButton } from './SavedItemsProvider'
import { useEffect, useState } from 'react'
import './NewsFeed.css'
import { PUBLISHER_LOGOS } from './publisherLogos'

import { newsBatches, filterNews, TOPICS } from './newsSelection'
import type { NewsItem, Region, TopicFilter } from './newsSelection'

interface Feed {
  items: NewsItem[]
  fetchedAt: number
  sources: { id: string; publisher: string; region: string; status: string; error?: string; checkedAt?: number | null; eligibleItems?: number; latestPublishedAt?: string | null }[]
}
const CACHE_KEY = 'anthracite_curated_news_v5'
const TTL = 10 * 60 * 1000
const FILTERS: { value: Region; label: string }[] = [
  { value: 'all', label: '전체' }, { value: 'global', label: '해외' }, { value: 'kr', label: '국내' },
]

function isFeed(value: unknown): value is Feed {
  if (!value || typeof value !== 'object') return false
  const data = value as Feed
  return Number.isFinite(data.fetchedAt) && data.fetchedAt <= Date.now() + 300000
    && Array.isArray(data.sources) && data.sources.every(source => source && typeof source.publisher === 'string' && typeof source.status === 'string')
    && Array.isArray(data.items) && data.items.every(item => item && typeof item.id === 'string'
      && typeof item.title === 'string' && typeof item.publisher === 'string'
      && typeof item.article_url === 'string' && /^https?:\/\//.test(item.article_url)
      && (item.image_url === undefined || (typeof item.image_url === 'string' && item.image_url.startsWith('https://')))
      && (item.image_credit === undefined || typeof item.image_credit === 'string')
      && Array.isArray(item.topics) && item.topics.length > 0
      && item.topics.every(topic => TOPICS.some(known => known.value === topic))
      && ['kr', 'global'].includes(item.region) && Number.isFinite(Date.parse(item.published_utc)))
}

function readCache(maxAge = TTL): Feed | null {
  try {
    const data: unknown = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null')
    return isFeed(data) && data.items.length > 0 && Date.now() - data.fetchedAt < maxAge ? data : null
  } catch { return null }
}

function relativeTime(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours}시간 전` : `${Math.floor(hours / 24)}일 전`
}

function NewsImage({ item, eager }: { item: NewsItem; eager: boolean }) {
  const [failed, setFailed] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const logo = PUBLISHER_LOGOS[item.publisher]
  const available = item.image_url?.startsWith('https://') && !failed
  return <figure className="news-image-wrap">
    <div className="news-image-frame">
      {available ? <img className="news-image" src={item.image_url} alt=""
        loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        onLoad={event => {
          const img = event.currentTarget
          if (img.naturalWidth < 160 || img.naturalHeight < 90) setFailed(true)
        }} /> : <span className="news-publisher-logo">
          {logo && !logoFailed && <img src={logo} alt={`${item.publisher} 로고`} loading="lazy" referrerPolicy="no-referrer" onError={() => setLogoFailed(true)} />}
          <span>{item.publisher}</span>
        </span>}
    </div>
    <figcaption className="news-image-credit" title={available ? item.image_credit : undefined}>
      {available ? item.image_credit : null}
    </figcaption>
  </figure>
}

export default function NewsFeed() {
  const [feed, setFeed] = useState<Feed | null>(() => readCache(6 * 60 * 60 * 1000))
  const [region, setRegion] = useSessionState<Region>('news.region', 'all', v => ['all', 'global', 'kr'].includes(String(v)))
  const [topic, setTopic] = useSessionState<TopicFilter>('news.topic', 'all', v => v === 'all' || TOPICS.some(t => t.value === v))
  const [query, setQuery] = useSessionState('news.query', '', v => typeof v === 'string' && v.length <= 120)
  const [view, setView] = useSessionState<'cards' | 'list'>('news.view', () => window.matchMedia('(max-width: 700px)').matches ? 'list' : 'cards', v => v === 'cards' || v === 'list')
  const [loading, setLoading] = useState(!feed)
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  const [visibleBatches, setVisibleBatches] = useSessionState('news.batches', 1, v => Number.isInteger(v) && Number(v) > 0 && Number(v) <= 500)
  const [, setClock] = useState(0)

  useEffect(() => {
    const refresh = window.setInterval(() => { setRevision(value => value + 1) }, TTL)
    const clock = window.setInterval(() => setClock(value => value + 1), 60000)
    return () => { window.clearInterval(refresh); window.clearInterval(clock) }
  }, [])

  useEffect(() => {
    if (revision === 0 && readCache()) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 18000)
    let active = true
    async function refresh() {
      setLoading(true)
      setFailed(false)
      try {
        const response = await fetch('/api/news', { signal: controller.signal })
        if (!response.ok) throw new Error('News unavailable')
        const data: unknown = await response.json()
        if (!isFeed(data)) throw new Error('Invalid news response')
        if (!active) return
        setFeed(data)
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* Storage is optional. */ }
      } catch {
        if (active) setFailed(true)
      } finally {
        window.clearTimeout(timeout)
        if (active) setLoading(false)
      }
    }
    void refresh()
    return () => { active = false; controller.abort(); window.clearTimeout(timeout) }
  }, [revision])

  const matching = filterNews(feed?.items || [], region, topic, query)
  const batches = newsBatches(matching, region)
  const news = batches.slice(0, visibleBatches).flat()
  const relevantSources = feed?.sources.filter(source => region === 'all' || source.region === region) || []
  const partial = relevantSources.some(source => source.status === 'unavailable')
  const publishers = [...new Set(news.map(item => item.publisher))]
  function article(item: NewsItem, index: number) {
    return (
      <article key={item.id} className="news-card">
        <a href={item.article_url} target="_blank" rel="noopener noreferrer" className="news-row">
          {view === 'cards' && <NewsImage key={item.image_url || item.id} item={item} eager={index < 2} />}
          <p className="news-meta news-publisher" title={item.publisher}>{item.publisher} · {item.region === 'kr' ? '국내' : '해외'}</p>
          <div className="news-topic-tags" aria-label="기사 주제">
            {TOPICS.filter(t => item.topics?.includes(t.value)).map(t => <span key={t.value}>{t.label}</span>)}
          </div>
          <h3 className="news-title" title={item.title}>{item.title}</h3>
          <p className="news-meta news-card-footer">
            <time dateTime={item.published_utc} title={new Date(item.published_utc).toLocaleString('ko-KR')}>
              {relativeTime(Date.parse(item.published_utc))}
            </time>
            <span className="news-original">원문 읽기 ↗</span>
          </p>
        </a>
      <BookmarkButton article={item} />
      </article>
    )
  }

  return (
    <div className="news-feed">
      <div className="news-toolbar">
        <div className="news-filters" role="group" aria-label="뉴스 지역 선택">
          {FILTERS.map(filter => (
            <button key={filter.value} type="button" aria-pressed={region === filter.value}
              onClick={() => { setRegion(filter.value); setVisibleBatches(1) }}>{filter.label}</button>
          ))}
        </div>
        <button type="button" className="news-refresh" disabled={loading} onClick={() => { setRevision(value => value + 1); setVisibleBatches(1) }}>
          {loading ? '불러오는 중…' : '새로고침'}
        </button>
      </div>
      <div className="news-topic-filters" role="group" aria-label="뉴스 주제 선택">
        {[{ value: 'all' as const, label: '전체 주제' }, ...TOPICS].map(t =>
          <button key={t.value} type="button" aria-pressed={topic === t.value} onClick={() => { setTopic(t.value); setVisibleBatches(1) }}>{t.label}</button>)}
      </div>
      <div className="news-search-tools">
        <label className="news-search"><span className="news-sr-only">기사 제목 또는 매체 검색</span>
          <input type="search" value={query} maxLength={120} onChange={event => { setQuery(event.target.value); setVisibleBatches(1) }} placeholder="기사 제목·매체 검색" />
        </label>
        <div className="news-view-toggle" role="group" aria-label="뉴스 표시 방식">
          <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>카드</button>
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>목록</button>
        </div>
      </div>
      <p className="news-scope">경제·테크·투자·기업 중심 · 제목과 매체 분류를 기준으로 자동 분류</p>
      {feed && <p className="news-updated">최근 수집: <time dateTime={new Date(feed.fetchedAt).toISOString()}
        title={new Date(feed.fetchedAt).toLocaleString('ko-KR')}>{relativeTime(feed.fetchedAt)}</time></p>}
      <div role="status" aria-live="polite">
        {failed ? <p className="news-notice">{news.length ? '업데이트하지 못해 이전 수집 기사를 표시합니다.' : '뉴스를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.'}</p>
          : partial ? <p className="news-notice">일부 매체의 뉴스를 불러오지 못했습니다. 수집된 기사를 표시합니다.</p> : null}
      </div>
      {!!relevantSources.length && <details className="news-source-status">
        <summary>매체별 수집 상태 · {relevantSources.filter(source => source.status === 'ok').length}/{relevantSources.length}개 피드 기사 확인</summary>
        <ul>{relevantSources.map(source => <li key={source.id}>
          <div><strong>{source.publisher}</strong><small>{source.id}</small></div>
          <span>{source.status === 'ok' ? '기사 확인' : source.status === 'empty' ? '72시간·주제 조건에 맞는 기사 없음' : source.status === 'not_configured' ? '피드 미설정 · 수집 대상에서 제외' : source.error === 'http_403' ? '출처 서버에서 접근 거부 (403)' : source.error === 'http_429' ? '출처 요청 한도 초과 (429)' : source.error === 'timeout' ? '출처 응답 시간 초과' : '수집 실패 · 다음 갱신 때 재시도'}</span>
          <small>조회 시각: {source.checkedAt ? dataTime(source.checkedAt) : source.status === 'not_configured' ? '조회하지 않음' : '시각 미제공'}{source.latestPublishedAt ? ` · 최근 기사: ${dataTime(source.latestPublishedAt)}` : ''}</small>
        </li>)}</ul>
        <p>상태는 피드별로 표시하며, 동일 매체의 피드가 여러 개일 수 있습니다. ‘기사 없음’은 수집 조건에 맞는 기사가 없다는 뜻입니다. 출처의 접근 제한이나 피드 미설정은 새로고침으로 해결되지 않을 수 있습니다.</p>
      </details>}
      <div aria-busy={loading}>
        {loading && !feed ? <div className="news-skeleton" aria-label="뉴스를 불러오는 중">
          <div /><div /><div />
        </div> : news.length ? <>
          <p className="news-result-count" role="status">조건에 맞는 {matching.length}개 중 {news.length}개 표시 · 묶음별 최신순 · 묶음당 매체별 최대 3개</p>
          <div className={view === 'cards' ? 'news-grid' : 'news-list'}>{news.map(article)}</div>
          {visibleBatches < batches.length && <button type="button" className="news-more" onClick={() => setVisibleBatches(value => value + 1)}>기사 더보기 (+{batches[visibleBatches].length})</button>}
          <p className="news-sources">표시 매체: {publishers.join(' · ')}</p>
        </> : !failed ? <div className="news-notice" role="status"><p>최근 72시간 내 선택한 조건에 맞는 기사가 없습니다.</p>
          {(topic !== 'all' || region !== 'all' || query) && <button className="news-reset" type="button" onClick={() => { setTopic('all'); setRegion('all'); setQuery(''); setVisibleBatches(1) }}>필터 초기화</button>}
        </div> : null}
      </div>
    </div>
  )
}

