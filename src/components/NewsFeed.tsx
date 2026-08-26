import { useEffect, useState } from 'react'

const KEY = import.meta.env.VITE_POLYGON_KEY
const poly = (path: string) =>
  `https://api.polygon.io${path}${path.includes('?') ? '&' : '?'}apiKey=${KEY}`

interface NewsItem {
  id: string
  title: string
  article_url: string
  published_utc: string
  image_url?: string
  publisher: { name: string }
  tickers?: string[]
}

const CACHE_KEY = 'anthracite_home_news_v2'
const CACHE_TTL = 1000 * 60 * 20 // 20분

async function loadNews(): Promise<{ items: NewsItem[]; ts: number } | null> {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Date.now() - parsed.ts < CACHE_TTL) return parsed
    }
  } catch {}

  try {
    const res = await fetch(poly('/v2/reference/news?limit=11&order=desc'))
    if (!res.ok) return null
    const data = await res.json()
    const items: NewsItem[] = data?.results || []
    if (items.length === 0) return null
    const result = { items, ts: Date.now() }
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(result)) } catch {}
    return result
  } catch {
    return null
  }
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

function timeAgoShort(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  return `${hours}시간 전`
}

export default function NewsFeed() {
  const [news, setNews] = useState<NewsItem[] | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let mounted = true
    loadNews().then(result => {
      if (!mounted) return
      if (result) { setNews(result.items); setUpdatedAt(result.ts) }
      else setFailed(true)
      setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  return (
    <div style={{ width: '100%' }}>
      <style>{`
        .news-row { transition: opacity 0.15s ease; text-decoration: none; color: inherit; display: block; }
        .news-row:hover { opacity: 0.55; }
      `}</style>

      {updatedAt && !loading && (
        <p style={{ fontSize: '11px', color: '#ccc', marginBottom: '20px', marginTop: '-16px' }}>
          최근 업데이트: {timeAgoShort(updatedAt)}
        </p>
      )}

      {loading ? (
        <>
          {/* 대표 기사 스켈레톤 */}
          <div style={{ marginBottom: '36px' }}>
            <div style={{ width: '100%', height: '340px', background: '#f0f0f0', borderRadius: '2px', marginBottom: '18px' }} />
            <div style={{ height: '28px', width: '80%', background: '#f0f0f0', borderRadius: '2px', marginBottom: '10px' }} />
            <div style={{ height: '13px', width: '30%', background: '#f5f5f5', borderRadius: '2px' }} />
          </div>
          {/* 나머지 그리드 스켈레톤 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px 24px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div style={{ width: '100%', height: '140px', background: '#f0f0f0', borderRadius: '2px', marginBottom: '12px' }} />
                <div style={{ height: '14px', width: '90%', background: '#f0f0f0', borderRadius: '2px', marginBottom: '8px' }} />
                <div style={{ height: '11px', width: '40%', background: '#f5f5f5', borderRadius: '2px' }} />
              </div>
            ))}
          </div>
        </>
      ) : failed || !news || news.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#bbb', padding: '20px 0' }}>뉴스를 불러오지 못했습니다.</p>
      ) : (
        <>
          {/* 대표 기사 (크게) */}
          {(() => {
            const lead = news[0]
            return (
              <a href={lead.article_url} target="_blank" rel="noopener noreferrer" className="news-row" style={{ marginBottom: '44px' }}>
                {lead.image_url && (
                  <img
                    src={lead.image_url}
                    alt=""
                    style={{ width: '100%', height: '340px', objectFit: 'cover', borderRadius: '2px', marginBottom: '20px' }}
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                )}
                <p style={{ fontSize: '30px', lineHeight: '1.3', color: '#000', marginBottom: '12px', fontWeight: '400' }}>
                  {lead.title}
                </p>
                <p style={{ fontSize: '13px', color: '#aaa' }}>
                  {lead.publisher?.name} · {timeAgo(lead.published_utc)}
                  {lead.tickers && lead.tickers.length > 0 && (
                    <span style={{ marginLeft: '8px', color: '#ccc' }}>· {lead.tickers.slice(0, 3).join(', ')}</span>
                  )}
                </p>
              </a>
            )
          })()}

          {/* 나머지 기사: 2열 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '36px 28px', borderTop: '1px solid #f0f0f0', paddingTop: '36px' }}>
            {news.slice(1).map(item => (
              <a key={item.id} href={item.article_url} target="_blank" rel="noopener noreferrer" className="news-row">
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt=""
                    style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '2px', marginBottom: '14px' }}
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                )}
                <p style={{ fontSize: '15px', lineHeight: '1.5', color: '#000', marginBottom: '8px' }}>
                  {item.title}
                </p>
                <p style={{ fontSize: '12px', color: '#aaa' }}>
                  {item.publisher?.name} · {timeAgo(item.published_utc)}
                </p>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}