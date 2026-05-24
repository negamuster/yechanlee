import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY
const fh = (path: string) => `https://finnhub.io/api/v1/${path}&token=${FINNHUB_KEY}`

interface Quote { c: number; d: number; dp: number; h: number; l: number; o: number; pc: number }
interface Profile { name: string; ticker: string; finnhubIndustry: string; marketCapitalization: number; shareOutstanding: number; logo: string; weburl: string; country: string; currency: string; exchange: string }
interface Metrics { metric: Record<string, number | string | null> }
interface NewsItem { headline: string; summary: string; url: string; datetime: number; source: string; image: string }
interface Candle { t: number; c: number; o: number; h: number; l: number }

// Finnhub marketCapitalization is in millions USD
function fmtCap(v: number | null | undefined): string {
  if (!v) return 'N/A'
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2) + 'T'
  if (v >= 1_000) return '$' + (v / 1_000).toFixed(1) + 'B'
  return '$' + v.toFixed(0) + 'M'
}

function fmt(n: number | string | null | undefined, prefix = '', suffix = '', digits = 2): string {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return 'N/A'
  const num = Number(n)
  return prefix + num.toFixed(digits) + suffix
}

function Spinner({ size = 24 }: { size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', border: '2px solid #e8e8e8', borderTopColor: '#000', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
}

// ── Price Chart ──────────────────────────────────────────────
function PriceChart({ candles, isPositive }: { candles: Candle[]; isPositive: boolean }) {
  if (!candles.length) return null

  const W = 1000, H = 220
  const pad = { top: 16, right: 16, bottom: 32, left: 64 }
  const prices = candles.map(c => c.c)
  const times = candles.map(c => c.t)
  const minP = Math.min(...prices), maxP = Math.max(...prices)
  const minT = Math.min(...times), maxT = Math.max(...times)
  const range = maxP - minP || 1

  const sx = (t: number) => pad.left + ((t - minT) / (maxT - minT || 1)) * (W - pad.left - pad.right)
  const sy = (p: number) => pad.top + ((maxP - p) / range) * (H - pad.top - pad.bottom)

  const pts = candles.map(c => `${sx(c.t).toFixed(1)},${sy(c.c).toFixed(1)}`).join(' ')
  const areaPts = `${sx(minT)},${H - pad.bottom} ${pts} ${sx(maxT)},${H - pad.bottom}`
  const color = isPositive ? '#16a34a' : '#ff3b30'

  // Y-axis grid lines (3 levels)
  const yLevels = [minP, minP + range / 2, maxP]

  // X-axis: pick ~5 date labels
  const step = Math.floor(candles.length / 4)
  const xLabels = [0, step, step * 2, step * 3, candles.length - 1]
    .filter((i, idx, arr) => arr.indexOf(i) === idx && i < candles.length)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yLevels.map((p, i) => (
        <g key={i}>
          <line x1={pad.left} x2={W - pad.right} y1={sy(p)} y2={sy(p)} stroke="#f0f0f0" strokeWidth="1" />
          <text x={pad.left - 8} y={sy(p) + 4} textAnchor="end" fontSize="10" fill="#bbb">${p.toFixed(0)}</text>
        </g>
      ))}

      {/* Area fill */}
      <polygon points={areaPts} fill="url(#chartGrad)" />

      {/* Price line */}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />

      {/* X-axis labels */}
      {xLabels.map(i => (
        <text key={i} x={sx(candles[i].t)} y={H - 8} textAnchor="middle" fontSize="10" fill="#bbb">
          {new Date(candles[i].t * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
        </text>
      ))}

      {/* Last price dot */}
      <circle cx={sx(candles[candles.length - 1].t)} cy={sy(candles[candles.length - 1].c)} r="3" fill={color} />
    </svg>
  )
}

// ── Main Component ───────────────────────────────────────────
export default function Stock() {
  const { ticker } = useParams<{ ticker: string }>()
  const navigate = useNavigate()
  const symbol = ticker?.toUpperCase() || ''

  const [quote, setQuote] = useState<Quote | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [news, setNews] = useState<NewsItem[]>([])
  const [peers, setPeers] = useState<string[]>([])
  const [candles, setCandles] = useState<Candle[]>([])
  const [period, setPeriod] = useState<'1M' | '3M' | '6M' | '1Y'>('3M')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [aiAnalysis, setAiAnalysis] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDone, setAiDone] = useState(false)
  const [searchQuery, setSearchQuery] = useState(symbol)

  const periodDays: Record<string, number> = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }

  const fetchCandles = useCallback(async (sym: string, days: number) => {
    const to = Math.floor(Date.now() / 1000)
    const from = to - days * 86400
    try {
      const res = await fetch(fh(`stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${to}`))
      const data = await res.json()
      if (data.s === 'ok' && data.t) {
        setCandles(data.t.map((t: number, i: number) => ({ t, c: data.c[i], o: data.o[i], h: data.h[i], l: data.l[i] })))
      }
    } catch {}
  }, [])

  useEffect(() => {
    setSearchQuery(symbol)
    if (!symbol) return
    loadData()
  }, [symbol])

  useEffect(() => {
    if (symbol) fetchCandles(symbol, periodDays[period])
  }, [period, symbol])

  const loadData = async () => {
    setLoading(true)
    setError('')
    setQuote(null); setProfile(null); setMetrics(null)
    setNews([]); setPeers([]); setCandles([])
    setAiAnalysis(''); setAiDone(false)

    const today = new Date()
    const from = new Date(today); from.setDate(from.getDate() - 30)
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
      if (newsRes.status === 'fulfilled') setNews((newsRes.value || []).slice(0, 6))
      if (peersRes.status === 'fulfilled') setPeers((peersRes.value || []).filter((p: string) => p !== symbol).slice(0, 8))
      if (!q || q.c === 0) setError('찾을 수 없는 종목입니다. 티커를 확인해주세요.')
      else await fetchCandles(symbol, periodDays['3M'])
    } catch { setError('데이터를 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }

  const generateAnalysis = async () => {
    if (!quote || !profile || aiLoading) return
    setAiLoading(true); setAiAnalysis(''); setAiDone(false)
    const m = metrics?.metric || {}
    const prompt = `다음은 ${profile.name}(${symbol})의 최신 재무 데이터입니다.

현재가: $${quote.c} (전일 대비 ${quote.dp > 0 ? '+' : ''}${quote.dp?.toFixed(2)}%)
52주 고/저: $${m['52WeekHigh'] ?? 'N/A'} / $${m['52WeekLow'] ?? 'N/A'}
P/E (TTM): ${m['peBasicExclExtraTTM'] ?? 'N/A'}
EPS (TTM): $${m['epsTTM'] ?? 'N/A'}
시가총액: ${fmtCap(profile.marketCapitalization)}
섹터: ${profile.finnhubIndustry ?? 'N/A'}
배당수익률: ${m['dividendYieldIndicatedAnnual'] ?? 0}%
ROE (TTM): ${m['roeTTM'] ?? 'N/A'}%
매출성장률 YoY: ${m['revenueGrowthTTMYoy'] ?? 'N/A'}%

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
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      setAiAnalysis(data.content?.[0]?.text || '분석 결과를 가져오지 못했습니다.')
      setAiDone(true)
    } catch { setAiAnalysis('분석을 불러오지 못했습니다.'); setAiDone(true) }
    finally { setAiLoading(false) }
  }

  const handleSearch = () => { const q = searchQuery.trim().toUpperCase(); if (q) navigate(`/stock/${q}`) }
  const isPositive = (quote?.dp ?? 0) >= 0
  const color = isPositive ? '#16a34a' : '#ff3b30'

  const fundamentals = !metrics ? [] : [
    { label: 'P/E (TTM)',      value: fmt(metrics.metric['peBasicExclExtraTTM']) },
    { label: 'P/B (연간)',     value: fmt(metrics.metric['pbAnnual']) },
    { label: 'EPS (TTM)',      value: fmt(metrics.metric['epsTTM'], '$') },
    { label: '배당수익률',     value: fmt(metrics.metric['dividendYieldIndicatedAnnual'], '', '%') },
    { label: '52주 최고',      value: fmt(metrics.metric['52WeekHigh'], '$') },
    { label: '52주 최저',      value: fmt(metrics.metric['52WeekLow'], '$') },
    { label: 'ROE (TTM)',      value: fmt(metrics.metric['roeTTM'], '', '%') },
    { label: '매출성장률 YoY', value: fmt(metrics.metric['revenueGrowthTTMYoy'], '', '%') },
    { label: 'Beta (5Y)',      value: fmt(metrics.metric['beta']) },
    { label: '부채비율 (연간)', value: fmt(metrics.metric['totalDebt/totalEquityAnnual'], '', '%') },
  ]

  const renderAiText = (text: string) =>
    text.split('\n').map((line, i) => {
      if (!line.trim()) return <div key={i} style={{ height: '10px' }} />
      const isBold = line.startsWith('**')
      const html = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      return <p key={i} dangerouslySetInnerHTML={{ __html: html }}
        style={{ fontSize: '14px', lineHeight: '1.85', color: isBold ? '#000' : '#444', margin: '0 0 4px', fontWeight: isBold ? '600' : '400' }} />
    })

  return (
    <>
      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);} }
        @keyframes spin { from{transform:rotate(0deg);}to{transform:rotate(360deg);} }
        .s1{opacity:0;animation:slideUp 0.6s ease forwards 0.05s;}
        .s2{opacity:0;animation:slideUp 0.6s ease forwards 0.15s;}
        .s3{opacity:0;animation:slideUp 0.6s ease forwards 0.25s;}
        .s4{opacity:0;animation:slideUp 0.6s ease forwards 0.35s;}
        .peer-chip{transition:opacity 0.15s;cursor:pointer;}
        .peer-chip:hover{opacity:0.4;}
        .news-row{transition:opacity 0.15s;cursor:pointer;text-decoration:none;color:inherit;}
        .news-row:hover{opacity:0.5;}
        .srch:focus{outline:none;}
        .srch::placeholder{color:#bbb;}
        .period-btn{cursor:pointer;border:none;background:none;font-family:inherit;transition:all 0.1s;}
        .ai-btn{transition:opacity 0.15s;cursor:pointer;font-family:inherit;}
        .ai-btn:hover{opacity:0.7;}
      `}</style>

      <div style={{ backgroundColor: '#fff', minHeight: '100vh', fontFamily: '"Times New Roman", Times, serif', color: '#000' }}>

        {/* NAV */}
        <nav style={{ padding: '28px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8e8e8' }}>
          <span onClick={() => navigate('/')} style={{ fontSize: '22px', fontWeight: '600', cursor: 'pointer' }}>Anthracite</span>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e8e8e8', position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input className="srch" type="text" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="티커 검색..."
              style={{ padding: '9px 12px 9px 34px', fontSize: '13px', fontFamily: '"Times New Roman",serif', border: 'none', width: '180px', background: 'transparent' }} />
            <button onClick={handleSearch} style={{ padding: '9px 14px', background: '#000', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '13px', fontFamily: '"Times New Roman",serif' }}>→</button>
          </div>
        </nav>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '20px' }}>
            <Spinner size={28} />
            <p style={{ fontSize: '14px', color: '#aaa' }}>{symbol} 데이터를 불러오는 중...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '100px 48px' }}>
            <p style={{ fontSize: '20px', marginBottom: '12px' }}>{error}</p>
            <p style={{ fontSize: '14px', color: '#aaa' }}>티커 예시: AAPL, NVDA, MSFT, GOOGL, TSLA</p>
          </div>
        ) : (
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 48px 120px' }}>

            {/* ── HEADER ── */}
            <div className="s1" style={{ marginBottom: '36px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  {profile?.logo && (
                    <img src={profile.logo} alt="" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'contain', border: '1px solid #f0f0f0' }}
                      onError={e => (e.currentTarget.style.display = 'none')} />
                  )}
                  <div>
                    <p style={{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: '3px' }}>
                      {symbol} · {profile?.exchange} · {profile?.finnhubIndustry}
                    </p>
                    <h1 style={{ fontSize: '32px', fontWeight: '400', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{profile?.name ?? symbol}</h1>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
                  <span style={{ fontSize: '48px', fontWeight: '400', letterSpacing: '-0.02em' }}>${quote?.c.toFixed(2)}</span>
                  <span style={{ fontSize: '18px', color }}>{isPositive ? '+' : ''}{quote?.d.toFixed(2)} ({isPositive ? '+' : ''}{quote?.dp.toFixed(2)}%)</span>
                </div>

                <div style={{ display: 'flex', gap: '24px', marginTop: '10px', fontSize: '13px', color: '#aaa', flexWrap: 'wrap' }}>
                  <span>시가 <b style={{ color: '#555' }}>${quote?.o.toFixed(2)}</b></span>
                  <span>고가 <b style={{ color: '#555' }}>${quote?.h.toFixed(2)}</b></span>
                  <span>저가 <b style={{ color: '#555' }}>${quote?.l.toFixed(2)}</b></span>
                  <span>전일 <b style={{ color: '#555' }}>${quote?.pc.toFixed(2)}</b></span>
                  <span>시총 <b style={{ color: '#555' }}>{fmtCap(profile?.marketCapitalization)}</b></span>
                </div>
              </div>

              {/* Peers */}
              {peers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '340px', justifyContent: 'flex-end' }}>
                  {peers.map(p => (
                    <span key={p} className="peer-chip" onClick={() => navigate(`/stock/${p}`)}
                      style={{ fontSize: '12px', padding: '6px 12px', border: '1px solid #e8e8e8', color: '#666' }}>
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── CHART ── */}
            <div className="s2" style={{ marginBottom: '48px', border: '1px solid #e8e8e8', padding: '24px 24px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa' }}>Price Chart</p>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {(['1M', '3M', '6M', '1Y'] as const).map(p => (
                    <button key={p} className="period-btn"
                      onClick={() => setPeriod(p)}
                      style={{ padding: '5px 12px', fontSize: '12px', color: period === p ? '#fff' : '#aaa', background: period === p ? '#000' : 'transparent', fontFamily: '"Times New Roman",serif' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              {candles.length > 0
                ? <PriceChart candles={candles} isPositive={isPositive} />
                : <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
              }
            </div>

            {/* ── TWO COLUMN ── */}
            <div className="s3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'start' }}>

              {/* LEFT: Fundamentals + News */}
              <div>
                {/* Fundamentals */}
                <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '16px' }}>Fundamentals</p>
                <div style={{ marginBottom: '48px' }}>
                  {fundamentals.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid #f4f4f4' }}>
                      <span style={{ fontSize: '13px', color: '#888' }}>{f.label}</span>
                      <span style={{ fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>{f.value}</span>
                    </div>
                  ))}
                </div>

                {/* News */}
                {news.length > 0 && (
                  <>
                    <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '16px' }}>Recent News</p>
                    {news.map((n, i) => (
                      <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="news-row">
                        <div style={{ padding: '16px 0', borderBottom: '1px solid #f4f4f4', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                          {n.image && (
                            <img src={n.image} alt="" style={{ width: '68px', height: '48px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0, marginTop: '2px' }}
                              onError={e => (e.currentTarget.style.display = 'none')} />
                          )}
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '14px', lineHeight: '1.5', marginBottom: '5px' }}>{n.headline}</p>
                            <p style={{ fontSize: '11px', color: '#aaa' }}>
                              {n.source} · {new Date(n.datetime * 1000).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </a>
                    ))}
                  </>
                )}
              </div>

              {/* RIGHT: AI Analysis */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa' }}>AI Analysis</p>
                  {!aiDone && (
                    <button className="ai-btn" onClick={generateAnalysis} disabled={aiLoading}
                      style={{ fontSize: '13px', padding: '8px 18px', background: aiLoading ? '#f5f5f5' : '#000', color: aiLoading ? '#aaa' : '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {aiLoading ? <><Spinner size={14} /> 분석 생성 중...</> : 'Claude로 분석 생성'}
                    </button>
                  )}
                </div>

                {aiAnalysis ? (
                  <div style={{ padding: '24px 28px', border: '1px solid #e8e8e8', borderLeft: '3px solid #000' }}>
                    {renderAiText(aiAnalysis)}
                    <p style={{ fontSize: '11px', color: '#ccc', marginTop: '16px' }}>* AI 분석은 참고용이며, 투자 권유가 아닙니다.</p>
                  </div>
                ) : (
                  <div style={{ padding: '24px 28px', border: '1px solid #e8e8e8', borderLeft: '3px solid #f0f0f0', minHeight: '120px', display: 'flex', alignItems: 'center' }}>
                    {aiLoading
                      ? <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}><Spinner /><span style={{ fontSize: '14px', color: '#aaa' }}>Claude가 분석 중입니다...</span></div>
                      : <p style={{ fontSize: '14px', color: '#bbb' }}>위 버튼을 눌러 AI 종목 분석을 확인하세요.</p>
                    }
                  </div>
                )}

                {/* 빠른 지표 요약 */}
                {quote && metrics && (
                  <div style={{ marginTop: '28px', padding: '20px 24px', border: '1px solid #e8e8e8', background: '#fafafa' }}>
                    <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: '14px' }}>Quick Summary</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {[
                        { label: '52주 위치', value: (() => { const h = Number(metrics.metric['52WeekHigh']), l = Number(metrics.metric['52WeekLow']); return h && l ? Math.round(((quote.c - l) / (h - l)) * 100) + '%' : 'N/A' })() },
                        { label: 'P/E', value: fmt(metrics.metric['peBasicExclExtraTTM']) },
                        { label: 'ROE', value: fmt(metrics.metric['roeTTM'], '', '%') },
                        { label: '매출성장', value: fmt(metrics.metric['revenueGrowthTTMYoy'], '', '%') },
                      ].map((item, i) => (
                        <div key={i} style={{ textAlign: 'center', padding: '12px', background: '#fff', border: '1px solid #f0f0f0' }}>
                          <p style={{ fontSize: '18px', fontWeight: '400', marginBottom: '4px' }}>{item.value}</p>
                          <p style={{ fontSize: '11px', color: '#aaa' }}>{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <footer style={{ borderTop: '1px solid #e8e8e8', padding: '32px 48px', fontSize: '12px', color: '#aaa' }}>
          <span>Anthracite © 2026</span>
        </footer>
      </div>
    </>
  )
}