import { useRefreshSchedule } from '../hooks/useRefreshSchedule'
import { needsRefresh, refreshAvailable, refreshPolicies } from '../lib/refreshPolicy'
import { loadResource } from '../utils/resourceCache'
import { useReadArticles } from '../hooks/useReadArticles'
import { createPortal } from 'react-dom'
import { isNewsSector, matchesSector } from './sectorNews'
import type { NewsSector } from './sectorNews'
import './SectorNews.css'
import { dataTime } from '../utils/dataTime'
import { useSessionState } from '../hooks/useSessionState'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import './NewsFeed.css'
import { PUBLISHER_LOGOS } from './publisherLogos'
import NewsArticle from './NewsArticle'
import MobileNewsFilters from './MobileNewsFilters'
import ResourceState from './ResourceState'
import { countNewsFilters, matchingNews } from '../lib/newsFilters'
import type { NewsFilters } from '../lib/newsFilters'
import { applyNewsSnapshot, isNewsFeed, newsIdentity, newsUpdateSummary, NEWS_REFRESH_INTERVAL, NEWS_SNAPSHOT_KEY, readNewsSnapshot, receiveNewsSnapshot } from '../lib/newsRefresh'
import type { NewsSnapshot } from '../lib/newsRefresh'
import { captureNewsAnchor, restoreNewsAnchor } from '../lib/newsReadingAnchor'
import type { NewsReadingAnchor } from '../lib/newsReadingAnchor'

import { newsBatches, filterNews, TOPICS } from './newsSelection'
import type { NewsItem, Region, TopicFilter } from './newsSelection'

const FILTERS: { value: Region; label: string }[] = [
  { value: 'all', label: '전체' }, { value: 'global', label: '해외' }, { value: 'kr', label: '국내' },
]

function relativeTime(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours}시간 전` : `${Math.floor(hours / 24)}일 전`
}

function NewsImage({ item }: { item: NewsItem }) {
  const [failed, setFailed] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const logo = PUBLISHER_LOGOS[item.publisher]
  const available = item.image_url?.startsWith('https://') && !failed
  return <figure className="news-image-wrap">
    <div className="news-image-frame">
      {available ? <img className="news-image" src={item.image_url} alt=""
        loading="lazy" decoding="async" referrerPolicy="no-referrer"
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

export default function NewsFeed({ compact = false, mobile = false, previewTarget = null, previewSector = null, onClearSector }: { compact?: boolean; mobile?: boolean; previewTarget?: HTMLElement | null; previewSector?: NewsSector | null; onClearSector?: () => void }) {
  const { isRead, mark } = useReadArticles()
  const [hideRead, setHideRead] = useSessionState('news.hideRead', false, v => typeof v === 'boolean')
  const [sectorFilter, setSectorFilter] = useSessionState<NewsSector | null>('news.sector', null, isNewsSector)
  const [snapshot, setSnapshot] = useState<NewsSnapshot>(() => readNewsSnapshot(typeof sessionStorage === 'undefined' ? null : sessionStorage))
  const feed = snapshot.current
  const latest = snapshot.latest
  const [region, setRegion] = useSessionState<Region>('news.region', 'all', v => ['all', 'global', 'kr'].includes(String(v)))
  const [topic, setTopic] = useSessionState<TopicFilter>('news.topic', 'all', v => v === 'all' || TOPICS.some(t => t.value === v))
  const [query, setQuery] = useSessionState('news.query', '', v => typeof v === 'string' && v.length <= 120)
  const [view, setView] = useSessionState<'cards' | 'list'>('news.view', mobile ? 'list' : 'cards', v => v === 'cards' || v === 'list')
  const [loading, setLoading] = useState(!feed)
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  const [automatic, setAutomatic] = useState(0)
  const manualRevision = useRef(0)
  const [visibleBatches, setVisibleBatches] = useSessionState('news.batches', 1, v => Number.isInteger(v) && Number(v) > 0 && Number(v) <= 500)
  const [filtersOpen, setFiltersOpen] = useSessionState('news.filtersOpen', !compact && !mobile, v => typeof v === 'boolean')
  const [mobileDraft, setMobileDraft] = useState<NewsFilters | null>(null)
  const filtersId = useId()
  const searchId = useId()
  const newsListId = useId()
  const searchInput = useRef<HTMLInputElement>(null)
  const [, setClock] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const anchor = useRef<NewsReadingAnchor | null>(null)
  const showLatest = useRef(false)
  const checkedAt = useRef(latest?.fetchedAt ?? 0)

  function preservePosition() { anchor.current ??= captureNewsAnchor(root.current) }
  useLayoutEffect(() => {
    if (showLatest.current) {
      showLatest.current = false
      anchor.current = null
      const article = root.current?.querySelector<HTMLElement>('.news-article')
      const list = document.getElementById(newsListId)
      const target = article ?? list
      const focus = article?.querySelector<HTMLElement>('[data-focus-key]') ?? list
      target?.scrollIntoView({ block: 'start', behavior: 'instant' })
      focus?.focus({ preventScroll: true })
    } else if (anchor.current) {
      const position = anchor.current
      anchor.current = null
      restoreNewsAnchor(root.current, position)
    }
  })
  useEffect(() => {
    if (snapshot.current) {
      try { sessionStorage.setItem(NEWS_SNAPSHOT_KEY, JSON.stringify(snapshot)) } catch { /* Reading also works without storage. */ }
    }
  }, [snapshot])

  useEffect(() => {
    const viewport = window.matchMedia('(max-width: 700px)')
    const discardDraft = () => { if (!viewport.matches) setMobileDraft(null) }
    viewport.addEventListener('change', discardDraft)
    return () => viewport.removeEventListener('change', discardDraft)
  }, [])

  useRefreshSchedule(refreshPolicies.news, () => checkedAt.current || null, () => setAutomatic(value => value + 1))
  useEffect(() => {
    const clock = window.setInterval(() => { preservePosition(); setClock(value => value + 1) }, 60000)
    return () => { window.clearInterval(clock) }
  }, [])

  useEffect(() => {
    const force = manualRevision.current !== revision
    manualRevision.current = revision
    if (!force && (!refreshAvailable() || !needsRefresh(checkedAt.current || null, NEWS_REFRESH_INTERVAL))) return
    let active = true
    async function refresh() {
      preservePosition()
      setLoading(true)
      setFailed(false)
      try {
        const data = await loadResource('/api/news', isNewsFeed, refreshPolicies.news.staleTime, force)
        if (!active) return
        preservePosition()
        checkedAt.current = Date.now()
        setSnapshot(previous => receiveNewsSnapshot(previous, data))
      } catch {
        if (active) { preservePosition(); setFailed(true) }
      } finally {
        if (active) { preservePosition(); setLoading(false) }
      }
    }
    void refresh()
    return () => { active = false }
  }, [revision, automatic])

  const currentFilters: NewsFilters = { region, topic, query, sector: sectorFilter, hideRead, view }
  const matching = matchingNews(feed?.items || [], currentFilters, isRead, snapshot.selectedAt)
  const updates = newsUpdateSummary(snapshot, currentFilters, isRead)
  const timeFeed = updates.available ? feed : latest
  const previewItems = filterNews(feed?.items || [], 'all', 'all', '', snapshot.selectedAt).filter(item => matchesSector(item.title, previewSector?.symbol ?? null) && (!hideRead || !isRead(item.article_url))).sort((a, b) => Date.parse(b.published_utc) - Date.parse(a.published_utc)).slice(0, 3)
  function showRelated() {
    setRegion('all'); setTopic('all'); setQuery(''); setSectorFilter(previewSector); setVisibleBatches(1)
    requestAnimationFrame(() => { const heading = document.getElementById('home-news-title'); heading?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); heading?.focus({ preventScroll: true }) })
  }
  const batches = newsBatches(matching, region, snapshot.selectedAt)
  const news = batches.slice(0, visibleBatches).flat()
  const relevantSources = latest?.sources.filter(source => region === 'all' || source.region === region) || []
  const partial = relevantSources.some(source => ['unavailable', 'stale'].includes(source.status))
  const previewPartial = latest?.sources.some(source => ['unavailable', 'stale'].includes(source.status)) ?? false
  const publishers = [...new Set(news.map(item => item.publisher))]
  const filterCount = countNewsFilters(currentFilters)
  function applyMobileFilters(filters: NewsFilters) {
    setRegion(filters.region); setTopic(filters.topic); setQuery(filters.query); setSectorFilter(filters.sector)
    setHideRead(filters.hideRead); setView(filters.view); setVisibleBatches(1); setMobileDraft(null)
  }
  function resetFilters() {
    setRegion('all'); setTopic('all'); setQuery(''); setSectorFilter(null); setHideRead(false); setVisibleBatches(1)
    searchInput.current?.focus({ preventScroll: true })
  }
  function retryNews() { setRevision(value => value + 1) }
  function applyUpdates() {
    showLatest.current = true
    setSnapshot(previous => applyNewsSnapshot(previous))
    setVisibleBatches(1)
  }
  function article(item: NewsItem) {
    return <NewsArticle key={newsIdentity(item)} item={item} mobile={mobile} read={isRead(item.article_url)}
      timeLabel={relativeTime(Date.parse(item.published_utc))} onRead={() => mark(item.article_url)}
      image={view === 'cards' ? <NewsImage key={item.image_url || item.id} item={item} /> : undefined} />
  }

  return (<>
    {previewTarget && createPortal(<section className="sector-news" aria-label="업종 관련 뉴스" aria-busy={loading}>
      <div className="sector-news-heading"><h3>{previewSector ? `${previewSector.name} News` : 'Market News'}</h3>{previewSector && <button type="button" onClick={onClearSector}>선택 해제</button>}</div>
      <p className="sector-news-note">{previewSector ? '제목 키워드 기준 관련 기사' : 'Maps 업종을 선택하면 관련 기사를 표시합니다.'}</p>
      <ResourceState label="업종 뉴스" loading={loading} error={failed} hasData={!!feed} stale={previewPartial} updatedAt={failed ? feed?.fetchedAt : undefined}
        failureMessage={!failed && previewPartial ? '일부 매체를 확인하지 못했습니다.' : undefined} onRetry={retryNews} />
      <ul>{previewItems.map(item => <li key={item.id} className={isRead(item.article_url) ? 'is-read' : undefined}><a onClick={() => mark(item.article_url)} onAuxClick={e => { if (e.button === 1) mark(item.article_url) }} href={item.article_url} target="_blank" rel="noopener noreferrer" title={item.title}>{item.title}</a><p>{isRead(item.article_url) ? '읽음 · ' : ''}{item.publisher} · <time dateTime={item.published_utc} title={new Date(item.published_utc).toLocaleString('ko-KR')}>{relativeTime(Date.parse(item.published_utc))}</time></p></li>)}</ul>
      {!loading && !failed && !previewItems.length && <p className="sector-news-note">{hideRead ? '최근 72시간 내 읽지 않은 관련 기사가 없습니다.' : '최근 72시간 내 관련 기사가 없습니다.'}</p>}
      <button type="button" className="sector-news-more" onClick={showRelated}>{previewSector ? '관련 기사 더 보기' : '전체 기사 보기'} ↓</button>
    </section>, previewTarget)}
    <div ref={root} className={`news-feed${compact ? ' news-feed-compact' : ''}${mobile ? ' mobile-news-feed' : ''}`}>
      <div className="news-controls">
        <div className="news-toolbar">
          <div className="news-filters" role="group" aria-label="뉴스 지역 선택">
            {FILTERS.map(filter => (
              <button key={filter.value} type="button" aria-pressed={region === filter.value}
                onClick={() => { setRegion(filter.value); setVisibleBatches(1) }}>{filter.label}</button>
            ))}
          </div>
          <div className="news-toolbar-actions">
            {!mobile && <div className="news-view-toggle" role="group" aria-label="뉴스 표시 방식">
              <button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>카드</button>
              <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>목록</button>
            </div>}
            <button type="button" className="news-refresh" aria-label={loading ? '새 기사 확인 중' : '새 기사 확인'} disabled={loading} onClick={retryNews}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9" /></svg>
              <span className={mobile || compact ? 'news-sr-only' : undefined}>{loading ? '확인 중…' : '새로고침'}</span>
            </button>
          </div>
        </div>
        <div className="news-search-tools">
          <div className="news-search">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
            <label className="news-sr-only" htmlFor={searchId}>기사 제목 또는 매체 검색</label>
            <input ref={searchInput} id={searchId} type="search" value={query} maxLength={120} onChange={event => { setQuery(event.target.value); setVisibleBatches(1) }} placeholder="기사 제목·매체 검색" />
            {query && <button type="button" className="news-search-clear" aria-label="검색어 지우기" onClick={() => { setQuery(''); setVisibleBatches(1); searchInput.current?.focus() }}><span aria-hidden="true">×</span></button>}
          </div>
          <button type="button" className="news-filter-toggle" aria-haspopup={mobile ? 'dialog' : undefined}
            data-active={filterCount > 0 || undefined}
            aria-expanded={mobile ? Boolean(mobileDraft) : filtersOpen} aria-controls={!mobile || mobileDraft ? filtersId : undefined}
            onClick={event => {
              if (mobile) { event.currentTarget.focus({ preventScroll: true }); setMobileDraft({ ...currentFilters }) }
              else setFiltersOpen(value => !value)
            }}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2.5" fill="currentColor" stroke="none" /><circle cx="15" cy="17" r="2.5" fill="currentColor" stroke="none" /></svg>
            필터{filterCount > 0 && <span className="news-filter-count">{filterCount}<span className="news-sr-only">개 적용</span></span>}
            {!mobile && <span className="news-filter-chevron" aria-hidden="true">⌄</span>}
          </button>
        </div>
        {!mobile && <div id={filtersId} className="news-filter-panel" hidden={!filtersOpen}>
          <div className="news-topic-filters" data-scroll-key="news-topics" role="group" aria-label="뉴스 주제 선택">
            {[{ value: 'all' as const, label: '전체 주제' }, ...TOPICS].map(t =>
              <button key={t.value} type="button" aria-pressed={topic === t.value} onClick={() => { setTopic(t.value); setVisibleBatches(1) }}>{t.label}</button>)}
          </div>
          <label className="news-read-toggle"><input type="checkbox" checked={hideRead} onChange={e => { setHideRead(e.target.checked); setVisibleBatches(1) }} /> 읽은 기사 숨기기 <small>이 브라우저에서 연 기사 기준</small></label>
          <p className="news-scope">경제·테크·투자·기업 중심 · 제목과 매체 분류를 기준으로 자동 분류{compact && <> · 최근 72시간 기사 · 묶음별 최신순 · 묶음당 매체별 최대 3개</>}</p>
        </div>}
        {filterCount > 0 && <div className="news-active-filters" role="group" aria-label="적용한 뉴스 필터">
          {region !== 'all' && <button type="button" aria-label={`${region === 'kr' ? '국내' : '해외'} 지역 필터 해제`} onClick={() => { setRegion('all'); setVisibleBatches(1) }}>{region === 'kr' ? '국내' : '해외'} <span aria-hidden="true">×</span></button>}
          {topic !== 'all' && <button type="button" aria-label={`${TOPICS.find(t => t.value === topic)?.label} 주제 필터 해제`} onClick={() => { setTopic('all'); setVisibleBatches(1) }}>{TOPICS.find(t => t.value === topic)?.label} <span aria-hidden="true">×</span></button>}
          {query.trim() && <button type="button" aria-label={`검색어 ${query} 해제`} title={`검색: ${query}`} onClick={() => { setQuery(''); setVisibleBatches(1); searchInput.current?.focus() }}><span className="news-query-chip">검색: {query}</span><span aria-hidden="true">×</span></button>}
          {sectorFilter && <button type="button" title="제목 키워드 기준" aria-label={`${sectorFilter.name} 업종 필터 해제`} onClick={() => { setSectorFilter(null); setVisibleBatches(1) }}>{sectorFilter.name} · 키워드 <span aria-hidden="true">×</span></button>}
          {hideRead && <button type="button" aria-label="읽은 기사 숨기기 해제" onClick={() => { setHideRead(false); setVisibleBatches(1) }}>읽지 않은 기사 <span aria-hidden="true">×</span></button>}
          <button type="button" className="news-clear-filters" onClick={resetFilters}>전체 초기화</button>
        </div>}
      </div>
      {mobile && mobileDraft && <MobileNewsFilters id={filtersId} value={mobileDraft} items={feed?.items || []}
        available={Boolean(feed)} isRead={isRead} onApply={applyMobileFilters} onDismiss={() => setMobileDraft(null)} />}
      <div className="news-status-area">
      {updates.available && <div className="news-update-notice" role="status" aria-live="polite">
        <button type="button" className="news-apply-updates" aria-controls={newsListId} onClick={applyUpdates}>
          {updates.count > 0 ? `새 기사 ${updates.count}건 보기` : '뉴스 목록 업데이트 보기'}<span aria-hidden="true">↑</span>
        </button>
      </div>}
      <ResourceState label="뉴스" loading={loading} error={failed} hasData={!!feed} stale={partial} updatedAt={failed ? feed?.fetchedAt : undefined}
        failureMessage={failed ? feed ? '갱신 실패 · 이전 수집 기사 표시 중' : '뉴스를 불러오지 못했습니다.' : '일부 매체를 확인하지 못했습니다.'}
        onRetry={retryNews} layout="news" />
      <div className="news-status-meta">
      {timeFeed && <p className="news-updated">{updates.available ? '목록 기준:' : '최근 확인:'} <time dateTime={new Date(timeFeed.fetchedAt).toISOString()}
        title={`최근 조회 ${dataTime(latest?.fetchedAt)} · 표시 목록 수집 ${dataTime(feed?.fetchedAt)}`}>{relativeTime(timeFeed.fetchedAt)}</time></p>}
      {!!relevantSources.length && <details className="news-source-status">
        <summary>매체별 수집 상태 · {relevantSources.filter(source => source.status === 'ok').length}/{relevantSources.filter(source => source.status !== 'not_configured').length}개 피드 기사 확인</summary>
        <ul>{relevantSources.map(source => <li key={source.id}>
          <div><strong>{source.publisher}</strong><small>{source.id}</small></div>
          <span>{source.status === 'stale' ? '갱신 실패 · 이전 수집 기사 표시' : source.status === 'ok' ? '기사 확인' : source.status === 'empty' ? '72시간·주제 조건에 맞는 기사 없음' : source.status === 'not_configured' ? '피드 미설정 · 수집 대상에서 제외' : source.error === 'http_403' ? '출처 서버에서 접근 거부 (403)' : source.error === 'http_404' ? '출처 피드 주소를 찾을 수 없음 (404)' : source.error === 'http_429' ? '출처 요청 한도 초과 (429)' : source.error === 'timeout' ? '출처 응답 시간 초과' : '수집 실패 · 대기 후 재시도'}</span>
          <small>조회 시각: {source.checkedAt ? dataTime(source.checkedAt) : source.status === 'not_configured' ? '조회하지 않음' : '시각 미제공'}{source.latestPublishedAt ? ` · 최근 기사: ${dataTime(source.latestPublishedAt)}` : ''}</small>
          {source.lastSuccessAt && source.status === 'stale' && <small>마지막 정상 수집: {dataTime(source.lastSuccessAt)} · 최대 6시간 유지</small>}
          {source.nextRetryAt && <small>재시도 가능 시각: {dataTime(source.nextRetryAt)}</small>}
        </li>)}</ul>
        <p>접근 거부는 30분, 주소 오류는 6시간 뒤부터 다시 확인합니다. 일시 오류가 반복되면 확인 간격이 길어지며, 출처가 요청한 대기 시간도 적용됩니다. 재시도 가능 시각 이후 다음 요청에서 확인합니다. 대기와 저장 자료는 서버 인스턴스 단위이며 재시작되면 초기화됩니다. 상태는 피드별로 표시하며, 동일 매체의 피드가 여러 개일 수 있습니다. ‘기사 없음’은 수집 조건에 맞는 기사가 없다는 뜻입니다. 출처의 접근 제한이나 피드 미설정은 새로고침으로 해결되지 않을 수 있습니다.</p>
      </details>}
      </div>
      </div>
      <div id={newsListId} className="news-results" tabIndex={-1} aria-busy={loading && !feed}>
        {loading && !feed ? null : news.length ? <>
          <p className="news-result-count" role="status">조건에 맞는 {matching.length}개 중 {news.length}개 표시{!compact && ' · 묶음별 최신순 · 묶음당 매체별 최대 3개'}</p>
          <div className={mobile ? 'mobile-news-articles' : view === 'cards' ? 'news-grid' : 'news-list'}>{news.map(article)}</div>
          {visibleBatches < batches.length && <button type="button" className="news-more" onClick={() => setVisibleBatches(value => value + 1)}>기사 더보기 (+{batches[visibleBatches].length})</button>}
          <p className="news-sources">표시 매체: {publishers.join(' · ')}</p>
        </> : !failed || feed ? <div className="news-notice" role="status">{mobile && <h3>조건에 맞는 기사가 없어요</h3>}<p>{failed || partial ? '표시 가능한 기사 중 선택한 조건에 맞는 기사가 없습니다.' : hideRead ? '최근 72시간 내 이 조건의 읽지 않은 기사가 없습니다.' : '최근 72시간 내 선택한 조건에 맞는 기사가 없습니다.'}</p>
          {filterCount > 0 && <button className="news-reset" type="button" onClick={resetFilters}>필터 초기화</button>}
        </div> : null}
      </div>
    </div>
  </>)
}

