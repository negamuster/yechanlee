import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY
const fh = (path: string) => `https://finnhub.io/api/v1/${path}&token=${FINNHUB_KEY}`

interface Quote { c: number; d: number; dp: number; h: number; l: number; o: number; pc: number }
interface Profile { name: string; ticker: string; finnhubIndustry: string; marketCapitalization: number; shareOutstanding: number; logo: string; weburl: string; country: string; currency: string; exchange: string }
interface Metrics { metric: Record<string, number | string | null> }
interface NewsItem { headline: string; summary: string; url: string; datetime: number; source: string; image: string }

function fmt(n: number | string | null | undefined, prefix = '', suffix = '', digits = 2): string {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return 'N/A'
  const num = Number(n)
  if (Math.abs(num) >= 1_000_000_000_000) return prefix + (num / 1_000_000_000_000).toFixed(1) + 'T' + suffix
  if (Math.abs(num) >= 1_000_000_000) return prefix + (num / 1_000_000_000).toFixed(1) + 'B' + suffix
  if (Math.abs(num) >= 1_000_000) return prefix + (num / 1_000_000).toFixed(1) + 'M' + suffix
  return prefix + num.toFixed(digits) + suffix
}

function Spinner() {
  return (
    <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid #e8e8e8', borderTopColor: '#000', animation: 'spin 0.8s linear infinite' }} />
  )
}

export default function Stock() {
  const { ticker } = useParams<{ ticker: string }>()
  const navigate = useNavigate()
  const symbol = ticker?.toUpperCase() || ''

  const [quote, setQuote] = useState<Quote | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [news, setNews] = useState<NewsItem[]>([])
  const [peers, setPeers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [aiAnalysis, setAiAnalysis] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDone, setAiDone] = useState(false)

  const [searchQuery, setSearchQuery] = useState(symbol)

  useEffect(() => {
    setSearchQuery(symbol)
    if (!symbol) return
    loadData()
  }, [symbol])

  const loadData = async () => {
    setLoading(true)
    setError('')
    setQuote(null)
    setProfile(null)
    setMetrics(null)
    setNews([])
    setPeers([])
    setAiAnalysis('')
    setAiDone(false)

    const today = new Date()
    const from = new Date(today)
    from.setDate(from.getDate() - 30)
    const toStr = today.toISOString().split('T')[0]
    const fromStr = from.toISOString().split('T')[0]

    try {
      const [quoteRes, profileRes, metricsRes, newsRes, peersRes] = await Promise.allSettled([
        fetch(fh(`quote?symbol=${symbol}`)).then(r => r.json()),
        fetch(fh(`stock/profile2?symbol=${symbol}`)).then(r => r.json()),
        fetch(fh(`stock/metric?symbol=${symbol}&metric=all`)).then(r => r.json()),
        fetch(fh(`company-news?symbol=${symbol}&from=${fromStr}&to=${toStr}`)).then(r => r.json()),
        fetch(fh(`stock/peers?symbol=${symbol}`)).then(r => r.json()),
      ])

      let q: Quote | null = null
      if (quoteRes.status === 'fulfilled') { q = quoteRes.value; setQuote(q) }
      if (profileRes.status === 'fulfilled') setProfile(profileRes.value)
      if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value)
      if (newsRes.status === 'fulfilled') setNews((newsRes.value || []).slice(0, 8))
      if (peersRes.status === 'fulfilled') setPeers((peersRes.value || []).filter((p: string) => p !== symbol).slice(0, 8))

      if (!q || q.c === 0) setError('찾을 수 없는 종목입니다. 티커를 확인해주세요.')
    } catch {
      setError('데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const generateAnalysis = async () => {
    if (!quote || !profile || aiLoading) return
    setAiLoading(true)
    setAiAnalysis('')
    setAiDone(false)

    const m = metrics?.metric || {}
    const prompt = `다음은 ${profile.name}(${symbol})의 최신 재무 데이터입니다.

현재가: $${quote.c} (전일 대비 ${quote.dp > 0 ? '+' : ''}${quote.dp?.toFixed(2)}%)
52주 고/저: $${m['52WeekHigh'] ?? 'N/A'} / $${m['52WeekLow'] ?? 'N/A'}
P/E (TTM): ${m['peBasicExclExtraTTM'] ?? 'N/A'}
EPS (TTM): ${m['epsTTM'] ?? 'N/A'}
시가총액: ${profile.marketCapitalization ? '$' + (profile.marketCapitalization / 1000).toFixed(1) + 'B' : 'N/A'}
섹터: ${profile.finnhubIndustry ?? 'N/A'}
배당수익률: ${m['dividendYieldIndicatedAnnual'] ?? 0}%
ROE (TTM): ${m['roeTTM'] ?? 'N/A'}%
부채비율 (연간): ${m['totalDebt/totalEquityAnnual'] ?? 'N/A'}
매출성장률 (TTM): ${m['revenueGrowthTTMYoy'] ?? 'N/A'}%

위 데이터를 바탕으로 이 종목에 대해 한국어로 분석해주세요. 아래 구조를 따르되, 각 항목은 자연스러운 문장으로 작성하세요:

**현재 상황**
(현재 주가 위치, 최근 주가 흐름, 시장 환경 2~3문장)

**핵심 강점**
(재무 지표 기반 강점 2가지, 각 1~2문장)

**주요 리스크**
(주의해야 할 리스크 2가지, 각 1~2문장)

**투자자 관점에서 주목할 점**
(밸류에이션, 성장성, 배당 등 종합 시각 2~3문장)

분석은 객관적이고 교육적인 톤으로 작성하며, 특정 투자 결정을 권유하지 마세요.`

    try {
      const res = await fetch('/api/claude-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || '분석 결과를 가져오지 못했습니다.'
      setAiAnalysis(text)
      setAiDone(true)
    } catch {
      setAiAnalysis('분석을 불러오지 못했습니다.')
      setAiDone(true)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSearch = () => {
    const q = searchQuery.trim().toUpperCase()
    if (q) navigate(`/stock/${q}`)
  }

  const isPositive = (quote?.dp ?? 0) >= 0

  const fundamentals = !metrics ? [] : [
    { label: 'P/E (TTM)', value: fmt(metrics.metric['peBasicExclExtraTTM']) },
    { label: 'P/B (연간)', value: fmt(metrics.metric['pbAnnual']) },
    { label: 'EPS (TTM)', value: fmt(metrics.metric['epsTTM'], '$') },
    { label: '52주 최고', value: fmt(metrics.metric['52WeekHigh'], '$') },
    { label: '52주 최저', value: fmt(metrics.metric['52WeekLow'], '$') },
    { label: '배당수익률', value: fmt(metrics.metric['dividendYieldIndicatedAnnual'], '', '%') },
    { label: 'ROE (TTM)', value: fmt(metrics.metric['roeTTM'], '', '%') },
    { label: '매출성장률 YoY', value: fmt(metrics.metric['revenueGrowthTTMYoy'], '', '%') },
    { label: 'Beta (5Y)', value: fmt(metrics.metric['beta'], '', '', 2) },
    { label: '부채비율 (연간)', value: fmt(metrics.metric['totalDebt/totalEquityAnnual'], '', '%') },
  ]

  // Render AI text with bold markdown
  const renderAiText = (text: string) => {
    return text.split('\n').map((line, i) => {
      const boldLine = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      return (
        <p key={i} dangerouslySetInnerHTML={{ __html: boldLine }}
          style={{ fontSize: '15px', lineHeight: '1.85', color: line.startsWith('**') ? '#000' : '#444', marginBottom: line.trim() === '' ? '12px' : '4px', fontWeight: line.startsWith('**') ? '500' : '400' }}
        />
      )
    })
  }

  return (
    <>
      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(30px);}to{opacity:1;transform:translateY(0);} }
        @keyframes spin { from{transform:rotate(0deg);}to{transform:rotate(360deg);} }
        .s1{opacity:0;animation:slideUp 0.7s ease forwards 0.1s;}
        .s2{opacity:0;animation:slideUp 0.7s ease forwards 0.25s;}
        .s3{opacity:0;animation:slideUp 0.7s ease forwards 0.4s;}
        .s4{opacity:0;animation:slideUp 0.7s ease forwards 0.55s;}
        .s5{opacity:0;animation:slideUp 0.7s ease forwards 0.7s;}
        .peer-chip{transition:opacity 0.15s;cursor:pointer;}
        .peer-chip:hover{opacity:0.4;}
        .news-item{transition:opacity 0.15s;cursor:pointer;}
        .news-item:hover{opacity:0.5;}
        .search-inp::placeholder{color:#bbb;}
        .search-inp:focus{outline:none;}
        .ai-btn{transition:all 0.15s;cursor:pointer;}
        .ai-btn:hover{opacity:0.7;}
      `}</style>

      <div style={{ backgroundColor: '#fff', minHeight: '100vh', fontFamily: '"Times New Roman", Times, serif', color: '#000' }}>

        {/* NAV */}
        <nav style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8e8e8' }}>
          <span onClick={() => navigate('/')} style={{ fontSize: '22px', fontWeight: '600', cursor: 'pointer' }}>Anthracite</span>

          {/* 인라인 검색바 */}
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e8e8e8', position: 'relative' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              className="search-inp"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="티커 검색..."
              style={{ padding: '10px 12px 10px 36px', fontSize: '13px', fontFamily: '"Times New Roman", Times, serif', border: 'none', width: '200px', background: 'transparent' }}
            />
            <button onClick={handleSearch} style={{ padding: '10px 14px', background: '#000', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#fff', fontFamily: '"Times New Roman", Times, serif' }}>
              →
            </button>
          </div>
        </nav>

        <div style={{ maxWidth: '860px', margin: '0 auto', padding: '64px 48px 120px' }}>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 0', gap: '20px' }}>
              <Spinner />
              <p style={{ fontSize: '14px', color: '#aaa' }}>{symbol} 데이터를 불러오는 중...</p>
            </div>
          ) : error ? (
            <div style={{ padding: '80px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '18px', marginBottom: '12px' }}>{error}</p>
              <p style={{ fontSize: '14px', color: '#aaa' }}>티커 예시: AAPL, NVDA, MSFT, GOOGL, TSLA</p>
            </div>
          ) : (
            <>
              {/* ── 헤더: 회사명 + 주가 ── */}
              <div className="s1" style={{ marginBottom: '56px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
                  {profile?.logo && (
                    <img src={profile.logo} alt={profile.name} style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #f0f0f0' }} onError={e => (e.currentTarget.style.display = 'none')} />
                  )}
                  <div>
                    <p style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '4px' }}>
                      {symbol} · {profile?.exchange ?? ''} · {profile?.finnhubIndustry ?? ''}
                    </p>
                    <h1 style={{ fontSize: '36px', fontWeight: '400', letterSpacing: '-0.02em', lineHeight: '1.1' }}>{profile?.name ?? symbol}</h1>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginTop: '20px' }}>
                  <span style={{ fontSize: '52px', fontWeight: '400', letterSpacing: '-0.02em' }}>
                    ${quote?.c.toFixed(2)}
                  </span>
                  <span style={{ fontSize: '20px', color: isPositive ? '#16a34a' : '#ff3b30' }}>
                    {isPositive ? '+' : ''}{quote?.d.toFixed(2)} ({isPositive ? '+' : ''}{quote?.dp.toFixed(2)}%)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '32px', marginTop: '16px', fontSize: '13px', color: '#aaa' }}>
                  <span>시가 ${quote?.o.toFixed(2)}</span>
                  <span>고가 ${quote?.h.toFixed(2)}</span>
                  <span>저가 ${quote?.l.toFixed(2)}</span>
                  <span>전일 종가 ${quote?.pc.toFixed(2)}</span>
                  {profile?.marketCapitalization && (
                    <span>시총 ${(profile.marketCapitalization / 1000).toFixed(1)}B</span>
                  )}
                </div>
              </div>

              {/* ── AI Analysis ── */}
              <div className="s2" style={{ marginBottom: '64px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa' }}>AI Analysis</p>
                  {!aiDone && (
                    <button
                      className="ai-btn"
                      onClick={generateAnalysis}
                      disabled={aiLoading}
                      style={{
                        fontSize: '13px', padding: '9px 20px',
                        background: aiLoading ? '#f5f5f5' : '#000',
                        color: aiLoading ? '#aaa' : '#fff',
                        border: 'none', cursor: aiLoading ? 'default' : 'pointer',
                        fontFamily: '"Times New Roman", Times, serif',
                        display: 'flex', alignItems: 'center', gap: '8px',
                      }}
                    >
                      {aiLoading ? (
                        <><Spinner />분석 생성 중...</>
                      ) : (
                        <>Claude로 분석 생성</>
                      )}
                    </button>
                  )}
                </div>

                {aiAnalysis ? (
                  <div style={{ padding: '28px 32px', border: '1px solid #e8e8e8', borderLeft: '3px solid #000' }}>
                    {renderAiText(aiAnalysis)}
                    <p style={{ fontSize: '11px', color: '#ccc', marginTop: '16px' }}>
                      * AI 분석은 참고용이며, 투자 권유가 아닙니다.
                    </p>
                  </div>
                ) : !aiLoading && (
                  <div style={{ padding: '28px 32px', border: '1px solid #e8e8e8', borderLeft: '3px solid #e8e8e8' }}>
                    <p style={{ fontSize: '14px', color: '#bbb' }}>위 버튼을 눌러 Claude AI의 종목 분석을 확인하세요.</p>
                  </div>
                )}
              </div>

              {/* ── Fundamentals ── */}
              <div className="s3" style={{ marginBottom: '64px' }}>
                <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '20px' }}>Fundamentals</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0' }}>
                  {fundamentals.map((f, i) => (
                    <div key={i} style={{ padding: '16px 0', borderBottom: '1px solid #f4f4f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: i % 2 === 0 ? '40px' : '0' }}>
                      <span style={{ fontSize: '13px', color: '#888' }}>{f.label}</span>
                      <span style={{ fontSize: '14px', color: '#000', fontVariantNumeric: 'tabular-nums' }}>{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── News ── */}
              {news.length > 0 && (
                <div className="s4" style={{ marginBottom: '64px' }}>
                  <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '20px' }}>Recent News</p>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {news.map((n, i) => (
                      <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div className="news-item" style={{ padding: '20px 0', borderBottom: '1px solid #f4f4f4' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '15px', lineHeight: '1.5', marginBottom: '6px', color: '#000' }}>{n.headline}</p>
                              <p style={{ fontSize: '12px', color: '#aaa' }}>
                                {n.source} · {new Date(n.datetime * 1000).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                              </p>
                            </div>
                            {n.image && (
                              <img src={n.image} alt="" style={{ width: '72px', height: '52px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }} onError={e => (e.currentTarget.style.display = 'none')} />
                            )}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Peers ── */}
              {peers.length > 0 && (
                <div className="s5">
                  <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '16px' }}>관련 종목</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {peers.map(p => (
                      <span key={p} className="peer-chip"
                        onClick={() => navigate(`/stock/${p}`)}
                        style={{ fontSize: '13px', padding: '8px 16px', border: '1px solid #e8e8e8', color: '#000' }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <footer style={{ borderTop: '1px solid #e8e8e8', padding: '32px 48px', fontSize: '12px', color: '#aaa' }}>
          <span>Anthracite © 2026</span>
        </footer>
      </div>
    </>
  )
}