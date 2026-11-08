import { useId } from 'react'
import type { ReactNode } from 'react'
import { BookmarkButton } from './SavedItemsProvider'
import EvidenceAttachButton from './EvidenceAttachButton'
import { newsEvidence } from '../lib/evidenceSources'
import { TOPICS } from './newsSelection'
import type { NewsItem } from './newsSelection'
import './NewsArticle.css'

export default function NewsArticle({ item, read, timeLabel, onRead, onRelatedRead, image, mobile = false }: {
  item: NewsItem; read: boolean; timeLabel: string; onRead: () => void; onRelatedRead?: (url: string) => void; image?: ReactNode; mobile?: boolean
}) {
  const metadataId = useId()
  const topics = <div className={mobile ? 'mobile-news-topics' : 'news-topic-tags'} aria-label="기사 주제">
    {TOPICS.filter(topic => item.topics?.includes(topic.value)).map(topic => <span key={topic.value}>{topic.label}</span>)}
  </div>
  return <article className={`news-article ${mobile ? 'mobile-news-article' : 'news-card'}${read ? ' is-read' : ''}`} data-reading-key={`news:${item.article_url}`}>
    {item.articleKind && <p className="news-article-kind" title="제목 기준 자동 분류이며 본문 검증을 뜻하지 않습니다.">{item.articleKind}</p>}
    {item.selectionReason && <p className="news-selection-reason">{item.selectionReason}</p>}
    {mobile && topics}
    <a className={mobile ? `mobile-news-link${image ? ' has-image' : ''}` : 'news-row'} href={item.article_url}
      data-focus-key={`news:${item.article_url}`} target="_blank" rel="noopener noreferrer"
      aria-describedby={metadataId} onClick={onRead} onAuxClick={event => { if (event.button === 1) onRead() }}>
      {!mobile && image}
      {!mobile && topics}
      <h3 className={mobile ? undefined : 'news-title'}>{item.title}</h3>
      {mobile && image && <div className="mobile-news-thumbnail">{image}</div>}
    </a>
    {!!item.related?.length && <details className="news-related">
      <summary>관련 보도 {item.related.length}건 · 제목·사건 단서 기준</summary>
      <ul>{item.related.map(other => <li key={other.article_url}><a onClick={() => onRelatedRead?.(other.article_url)} onAuxClick={event => { if (event.button === 1) onRelatedRead?.(other.article_url) }} href={other.article_url} target="_blank" rel="noopener noreferrer">{other.title}</a><span>{other.publisher} · <time dateTime={other.published_utc}>{new Date(other.published_utc).toLocaleString('ko-KR')}</time></span></li>)}</ul>
    </details>}
    <div className={`news-article-footer${mobile ? ' mobile-news-footer' : ''}`}>
      <div className="news-article-metadata" id={metadataId}>
        <p className="news-article-publisher">{item.publisher}</p>
        <p className="news-article-time"><time dateTime={item.published_utc} title={new Date(item.published_utc).toLocaleString('ko-KR')}>{timeLabel}</time>
          <span aria-hidden="true">·</span><span>{item.region === 'kr' ? '국내' : '해외'}</span>
          {read && <span className="news-read-badge">읽음</span>}
        </p>
        {item.feedStale && <p className="news-article-stale">이전 수집 기사</p>}
      </div>
      <BookmarkButton article={item} iconOnly={!mobile} /><EvidenceAttachButton source={newsEvidence(item, !!item.feedStale)} />
    </div>
  </article>
}
