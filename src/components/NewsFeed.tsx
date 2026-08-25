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

const CACHE_KEY = 'anthracite_home_news'
const CACHE_TTL = 1000 * 60 * 20 // 20분

async function loadNews(): Promise<NewsItem[] | null> {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Date.now() - parsed.ts < CACHE_TTL) return parsed.data
    }
  } catch {}

  try {
    const res = await fetch(poly('/v2/reference/news?limit=10&order=desc'))
    if (!res.ok) return null
    const data = await res.json()
    const items: NewsItem[] = data?.results || []
    if (items.length === 0) return null
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: items })) } catch {}
    return items
  } catch {
    return null
  }
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

export default function NewsFeed() {
  const [news, setNews] = useState<NewsItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let mounted = true
    loadNews().then(items => {
      if (!mounted) return
      if (items) setNews(items)
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

      {loading ? (
        Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: '16px', padding: '20px 0', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ width: '96px', height: '68px', background: '#f0f0f0', borderRadius: '2px', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: '14px', width: '85%', background: '#f0f0f0', borderRadius: '2px', marginBottom: '10px' }} />
              <div style={{ height: '14px', width: '55%', background: '#f0f0f0', borderRadius: '2px', marginBottom: '10px' }} />
              <div style={{ height: '11px', width: '30%', background: '#f5f5f5', borderRadius: '2px' }} />
            </div>
          </div>
        ))
      ) : failed || !news ? (
        <p style={{ fontSize: '13px', color: '#bbb', padding: '20px 0' }}>뉴스를 불러오지 못했습니다.</p>
      ) : (
        news.map(item => (
          <a key={item.id} href={item.article_url} target="_blank" rel="noopener noreferrer" className="news-row">
            <div style={{ display: 'flex', gap: '16px', padding: '20px 0', borderBottom: '1px solid #f0f0f0', alignItems: 'flex-start' }}>
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt=""
                  style={{ width: '96px', height: '68px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }}
                  onError={e => (e.currentTarget.style.display = 'none')}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '15px', lineHeight: '1.5', color: '#000', marginBottom: '8px' }}>
                  {item.title}
                </p>
                <p style={{ fontSize: '12px', color: '#aaa' }}>
                  {item.publisher?.name} · {timeAgo(item.published_utc)}
                  {item.tickers && item.tickers.length > 0 && (
                    <span style={{ marginLeft: '8px', color: '#ccc' }}>· {item.tickers.slice(0, 3).join(', ')}</span>
                  )}
                </p>
              </div>
            </div>
          </a>
        ))
      )}
    </div>
  )
}