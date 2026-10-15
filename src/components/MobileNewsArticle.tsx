import { useId } from 'react'
import type { ReactNode } from 'react'
import { BookmarkButton } from './SavedItemsProvider'
import { TOPICS } from './newsSelection'
import type { NewsItem } from './newsSelection'
import './MobileNewsArticle.css'

export default function MobileNewsArticle({ item, read, timeLabel, onRead, image }: {
  item: NewsItem; read: boolean; timeLabel: string; onRead: () => void; image?: ReactNode
}) {
  const metadataId = useId()
  return <article className={`mobile-news-article${read ? ' is-read' : ''}`} data-reading-key={`news:${item.article_url}`}>
    <div className="mobile-news-topics" aria-label="기사 주제">
      {TOPICS.filter(topic => item.topics?.includes(topic.value)).map(topic => <span key={topic.value}>{topic.label}</span>)}
    </div>
    <a className={`mobile-news-link${image ? ' has-image' : ''}`} href={item.article_url}
      data-focus-key={`news:${item.article_url}`} target="_blank" rel="noopener noreferrer"
      aria-describedby={metadataId} onClick={onRead} onAuxClick={event => { if (event.button === 1) onRead() }}>
      <h3>{item.title}</h3>
      {image && <div className="mobile-news-thumbnail">{image}</div>}
    </a>
    <div className="mobile-news-footer">
      <div className="mobile-news-metadata" id={metadataId}>
        <p className="mobile-news-publisher">{item.publisher}</p>
        <p className="mobile-news-time"><time dateTime={item.published_utc} title={new Date(item.published_utc).toLocaleString('ko-KR')}>{timeLabel}</time>
          <span aria-hidden="true">·</span><span>{item.region === 'kr' ? '국내' : '해외'}</span>
          {read && <span className="news-read-badge">읽음</span>}
        </p>
        {item.feedStale && <p className="mobile-news-stale">이전 수집 기사</p>}
      </div>
      <BookmarkButton article={item} />
    </div>
  </article>
}
