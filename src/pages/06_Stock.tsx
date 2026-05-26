import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const KEY = import.meta.env.VITE_POLYGON_KEY
const poly = (path: string) =>
  `https://api.polygon.io${path}${path.includes('?') ? '&' : '?'}apiKey=${KEY}`

function dateStr(daysAgo = 0): string {
  const d = new Date(); d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}
function fmtCap(v: number | null | undefined): string {
  if (!v) return 'N/A'
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T'
  if (v >= 1e9)  return '$' + (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6)  return '$' + (v / 1e6).toFixed(1) + 'M'
  return '$' + v.toFixed(0)
}
function fmtNum(v: any, prefix = '', suffix = '', digits = 2): string {
  const n = Number(v)
  if (v == null || isNaN(n)) return 'N/A'
  return prefix + n.toFixed(digits) + suffix
}
function fmtLarge(v: number | null | undefined): string {
  if (!v) return 'N/A'
  if (v >= 1e9)  return '$' + (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6)  return '$' + (v / 1e6).toFixed(1) + 'M'
  return '$' + v.toFixed(0)
}

function Spinner({ size = 24 }: { size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', border: '2px solid #e8e8e8', borderTopColor: '#000', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
}

// ── Price Chart ──────────────────────────────────────────────
interface Candle { t: number; c: number }
function PriceChart({ candles, isPositive }: { candles: Candle[]; isPositive: boolean }) {
  if (!candles.length) return null
  const W = 1000, H = 220, pad = { top: 16, right: 16, bottom: 32, left: 64 }
  const prices = candles.map(c => c.c)
  const minP = Math.min(...prices), maxP = Math.max(...prices), range = maxP - minP || 1
  const minT = candles[0].t, maxT = candles[candles.length - 1].t
  const sx = (t: number) => pad.left + ((t - minT) / (maxT - minT || 1)) * (W - pad.left - pad.right)
  const sy = (p: number) => pad.top + ((maxP - p) / range) * (H - pad.top - pad.bottom)
  const pts = candles.map(c => `${sx(c.t).toFixed(1)},${sy(c.c).toFixed(1)}`).join(' ')
  const color = isPositive ? '#16a34a' : '#ff3b30'
  const step = Math.floor(candles.length / 4)
  const xIdx = [0, step, step * 2, step * 3, candles.length - 1].filter((v, i, a) => a.indexOf(v) === i && v < candles.length)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.12" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[minP, minP + range / 2, maxP].map((p, i) => (
        <g key={i}>
          <line x1={pad.left} x2={W - pad.right} y1={sy(p)} y2={sy(p)} stroke="#f0f0f0" strokeWidth="1" />
          <text x={pad.left - 8} y={sy(p) + 4} textAnchor="end" fontSize="10" fill="#bbb">${p.toFixed(0)}</text>
        </g>
      ))}
      <polygon points={`${sx(minT)},${H - pad.bottom} ${pts} ${sx(maxT)},${H - pad.bottom}`} fill="url(#cg)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      {xIdx.map(i => (
        <text key={i} x={sx(candles[i].t)} y={H - 8} textAnchor="middle" fontSize="10" fill="#bbb">
          {new Date(candles[i].t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </text>
      ))}
      <circle cx={sx(candles[candles.length - 1].t)} cy={sy(candles[candles.length - 1].c)} r="3" fill={color} />
    </svg>
  )
}

// ── Main Component ───────────────────────────────────────────
export default function Stock() {
  const { ticker } = useParams<{ ticker: string }>()
  const navigate = useNavigate()
  const symbol = ticker?.toUpperCase() || ''

  const [details, setDetails] = useState<any>(null)
  const [prevDay, setPrevDay] = useState<any>(null)
  const [candles, setCandles] = useState<Candle[]>([])
  const [yearCandles, setYearCandles] = useState<Candle[]>([])
  const [news, setNews] = useState<any[]>([])
  const [related, setRelated] = useState<string[]>([])
  const [financials, setFinancials] = useState<any[]>([])
  const [period, setPeriod] = useState<'1M' | '3M' | '6M' | '1Y'>('3M')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aiAnalysis, setAiAnalysis] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDone, setAiDone] = useState(false)
  const [searchQuery, setSearchQuery] = useState(symbol)

  const periodDays: Record<string, number> = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }

  const fetchCandles = useCallback(async (sym: string, days: number) => {
    try {
      const from = dateStr(days), to = dateStr(0)
      const res = await fetch(poly(`/v2/aggs/ticker/${sym}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=500`))
      const data = await res.json()
      if (data.results) setCandles(data.results.map((b: any) => ({ t: Math.floor(b.t / 1000), c: b.c })))
    } catch {}
  }, [])

  useEffect(() => { setSearchQuery(symbol); if (symbol) loadData() }, [symbol])
  useEffect(() => { if (symbol) fetchCandles(symbol, periodDays[period]) }, [period, symbol])

  const loadData = async () => {
  setLoading(true); setError('')
  setDetails(null); setPrevDay(null); setCandles([]); setYearCandles([])
  setNews([]); setRelated([]); setFinancials([])
  setAiAnalysis(''); setAiDone(false)

  try {
    // 1단계: 핵심 데이터만 먼저 (3개)
    const [detRes, prevRes, newsRes] = await Promise.allSettled([
      fetch(poly(`/v3/reference/tickers/${symbol}`)).then(r => r.json()),
      fetch(poly(`/v2/aggs/ticker/${symbol}/prev?adjusted=true`)).then(r => r.json()),
      fetch(poly(`/v2/reference/news?ticker=${symbol}&limit=8&order=desc`)).then(r => r.json()),
    ])

    if (detRes.status === 'fulfilled' && detRes.value?.results) {
      setDetails(detRes.value.results)
    } else {
      setError('찾을 수 없는 종목입니다. 티커를 확인해주세요.')
      setLoading(false); return
    }
    if (prevRes.status === 'fulfilled' && prevRes.value?.results?.[0]) setPrevDay(prevRes.value.results[0])
    if (newsRes.status === 'fulfilled') setNews(newsRes.value?.results || [])

    setLoading(false)

    // 2단계: 나머지 데이터 (차트, 관련종목, 재무) — 약간 딜레이 후
    await new Promise(r => setTimeout(r, 500))

    const [relRes, finRes, yrRes] = await Promise.allSettled([
      fetch(poly(`/v1/related-companies/${symbol}`)).then(r => r.json()),
      fetch(poly(`/vX/reference/financials?ticker=${symbol}&timeframe=annual&limit=2&order=desc`)).then(r => r.json()),
      fetch(poly(`/v2/aggs/ticker/${symbol}/range/1/day/${dateStr(365)}/${dateStr(0)}?adjusted=true&sort=asc&limit=365`)).then(r => r.json()),
    ])

    if (relRes.status === 'fulfilled') setRelated((relRes.value?.results || []).map((r: any) => r.ticker).slice(0, 8))
    if (finRes.status === 'fulfilled') setFinancials(finRes.value?.results || [])
    if (yrRes.status === 'fulfilled' && yrRes.value?.results) {
      setYearCandles(yrRes.value.results.map((b: any) => ({ t: Math.floor(b.t / 1000), c: b.c })))
    }

    await fetchCandles(symbol, 90)

  } catch { setError('데이터를 불러오지 못했습니다.') }
  finally { setLoading(false) }
}

  // Derived financials
  const fin0 = financials[0]?.financials
  const fin1 = financials[1]?.financials
  const eps = fin0?.income_statement?.diluted_earnings_per_share?.value ?? null
  const revenue = fin0?.income_statement?.revenues?.value ?? null
  const revenue1 = fin1?.income_statement?.revenues?.value ?? null
  const netIncome = fin0?.income_statement?.net_income_loss?.value ?? null
  const equity = fin0?.balance_sheet?.equity?.value ?? null
  const liabilities = fin0?.balance_sheet?.liabilities?.value ?? null
  const currentPrice = prevDay?.c ?? 0
  const pe = eps && currentPrice ? currentPrice / eps : null
  const roe = netIncome && equity ? (netIncome / equity) * 100 : null
  const debtEquity = liabilities && equity ? liabilities / equity : null
  const revenueGrowth = revenue && revenue1 ? ((revenue - revenue1) / Math.abs(revenue1)) * 100 : null
  const week52High = yearCandles.length ? Math.max(...yearCandles.map(c => c.c)) : null
  const week52Low  = yearCandles.length ? Math.min(...yearCandles.map(c => c.c)) : null

  const change = prevDay ? (prevDay.c - prevDay.o) : 0
  const changePct = prevDay && prevDay.o ? ((prevDay.c - prevDay.o) / prevDay.o) * 100 : 0
  const isPositive = change >= 0
  const priceColor = isPositive ? '#16a34a' : '#ff3b30'

  const generateAnalysis = async () => {
    if (!details || aiLoading) return
    setAiLoading(true); setAiAnalysis(''); setAiDone(false)
    const prompt = `다음은 ${details.name}(${symbol})의 최신 재무 데이터입니다.

현재가: $${currentPrice.toFixed(2)} (전일 대비 ${isPositive ? '+' : ''}${changePct.toFixed(2)}%)
시가총액: ${fmtCap(details.market_cap)}
섹터/산업: ${details.sic_description || 'N/A'}
P/E Ratio: ${pe ? pe.toFixed(1) : 'N/A'}
EPS (Annual): ${eps ? '$' + eps.toFixed(2) : 'N/A'}
매출 (Annual): ${fmtLarge(revenue)}
순이익 (Annual): ${fmtLarge(netIncome)}
ROE: ${roe ? roe.toFixed(1) + '%' : 'N/A'}
매출성장률 YoY: ${revenueGrowth ? revenueGrowth.toFixed(1) + '%' : 'N/A'}
52주 고/저: ${week52High ? '$' + week52High.toFixed(2) : 'N/A'} / ${week52Low ? '$' + week52Low.toFixed(2) : 'N/A'}
회사 설명: ${details.description?.slice(0, 300) || 'N/A'}

위 데이터를 바탕으로 이 종목에 대해 한국어로 분석해주세요. 아래 구조를 따르되, 각 항목은 자연스러운 문장으로 작성하세요:

**현재 상황**
(현재 주가 위치, 최근 주가 흐름 2~3문장)

**핵심 강점**
(재무 지표 기반 강점 2가지, 각 1~2문장)

**주요 리스크**
(주의해야 할 리스크 2가지, 각 1~2문장)

**투자자 관점에서 주목할 점**
(밸류에이션, 성장성, 수익성 등 종합 시각 2~3문장)

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

  const fundamentals = [
    { label: 'P/E Ratio',       value: pe ? pe.toFixed(1) : 'N/A' },
    { label: 'EPS (Annual)',    value: eps ? '$' + eps.toFixed(2) : 'N/A' },
    { label: 'Revenue',         value: fmtLarge(revenue) },
    { label: 'Net Income',      value: fmtLarge(netIncome) },
    { label: 'ROE',             value: roe ? roe.toFixed(1) + '%' : 'N/A' },
    { label: 'Revenue Growth',  value: revenueGrowth ? revenueGrowth.toFixed(1) + '%' : 'N/A' },
    { label: 'Debt / Equity',   value: debtEquity ? debtEquity.toFixed(2) + 'x' : 'N/A' },
    { label: '52W High',        value: week52High ? '$' + week52High.toFixed(2) : 'N/A' },
    { label: '52W Low',         value: week52Low ? '$' + week52Low.toFixed(2) : 'N/A' },
    { label: 'Market Cap',      value: fmtCap(details?.market_cap) },
  ]

  const quickSummary = [
    { label: 'Market Cap',     value: fmtCap(details?.market_cap) },
    { label: 'P/E Ratio',      value: pe ? pe.toFixed(1) : 'N/A' },
    { label: 'EPS (Annual)',   value: eps ? '$' + eps.toFixed(2) : 'N/A' },
    { label: 'ROE',            value: roe ? roe.toFixed(1) + '%' : 'N/A' },
    { label: 'Revenue Growth', value: revenueGrowth ? revenueGrowth.toFixed(1) + '%' : 'N/A' },
    { label: 'Net Income',     value: fmtLarge(netIncome) },
    { label: '52W High',       value: week52High ? '$' + week52High.toFixed(2) : 'N/A' },
    { label: '52W Position',   value: week52High && week52Low ? Math.round(((currentPrice - week52Low) / (week52High - week52Low)) * 100) + '%' : 'N/A' },
  ]

  const renderAiText = (text: string) =>
    text.split('\n').map((line, i) => {
      if (!line.trim()) return <div key={i} style={{ height: '10px' }} />
      const isBold = line.startsWith('**')
      const html = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      return <p key={i} dangerouslySetInnerHTML={{ __html: html }}
        style={{ fontSize: '14px', lineHeight: '1.85', color: isBold ? '#000' : '#444', margin: '0 0 4px', fontWeight: isBold ? '600' : '400' }} />
    })

  const logoUrl = details?.branding?.icon_url ? `${details.branding.icon_url}?apiKey=${KEY}` : null

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
        .news-row{transition:opacity 0.15s;text-decoration:none;color:inherit;display:block;}
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
              placeholder="Search ticker..."
              style={{ padding: '9px 12px 9px 34px', fontSize: '13px', fontFamily: '"Times New Roman",serif', border: 'none', width: '180px', background: 'transparent' }} />
            <button onClick={handleSearch} style={{ padding: '9px 14px', background: '#000', border: 'none', cursor: 'pointer', color: '#fff', fontSize: '13px', fontFamily: '"Times New Roman",serif' }}>→</button>
          </div>
        </nav>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '20px' }}>
            <Spinner size={28} /><p style={{ fontSize: '14px', color: '#aaa' }}>{symbol} 데이터를 불러오는 중...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '100px 48px' }}>
            <p style={{ fontSize: '20px', marginBottom: '12px' }}>{error}</p>
            <p style={{ fontSize: '14px', color: '#aaa' }}>티커 예시: AAPL, NVDA, MSFT, GOOGL, TSLA</p>
          </div>
        ) : details && (
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 48px 120px' }}>

            {/* HEADER */}
            <div className="s1" style={{ marginBottom: '36px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
                  {logoUrl && (
                    <img src={logoUrl} alt="" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'contain', border: '1px solid #f0f0f0' }}
                      onError={e => (e.currentTarget.style.display = 'none')} />
                  )}
                  <div>
                    <p style={{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: '3px' }}>
                      {symbol} · {details.primary_exchange} · {details.sic_description}
                    </p>
                    <h1 style={{ fontSize: '32px', fontWeight: '400', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{details.name}</h1>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
                  <span style={{ fontSize: '48px', fontWeight: '400', letterSpacing: '-0.02em' }}>${currentPrice.toFixed(2)}</span>
                  <span style={{ fontSize: '18px', color: priceColor }}>
                    {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0', marginTop: '14px', flexWrap: 'wrap', borderTop: '1px solid #f0f0f0', paddingTop: '14px' }}>
                  {[
                    { label: 'Open',       value: `$${fmtNum(prevDay?.o)}` },
                    { label: 'High',       value: `$${fmtNum(prevDay?.h)}` },
                    { label: 'Low',        value: `$${fmtNum(prevDay?.l)}` },
                    { label: 'Prev Close', value: `$${fmtNum(prevDay?.c)}` },
                    { label: 'Market Cap', value: fmtCap(details.market_cap) },
                  ].map((s, i) => (
                    <div key={i} style={{ paddingRight: '28px', marginRight: '28px', borderRight: i < 4 ? '1px solid #f0f0f0' : 'none' }}>
                      <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px' }}>{s.label}</p>
                      <p style={{ fontSize: '14px', fontWeight: '500' }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {related.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '300px', justifyContent: 'flex-end' }}>
                  {related.map(p => (
                    <span key={p} className="peer-chip" onClick={() => navigate(`/stock/${p}`)}
                      style={{ fontSize: '12px', padding: '6px 12px', border: '1px solid #e8e8e8', color: '#666' }}>{p}</span>
                  ))}
                </div>
              )}
            </div>

            {/* CHART */}
            <div className="s2" style={{ marginBottom: '48px', border: '1px solid #e8e8e8', padding: '20px 24px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa' }}>Price Chart</p>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {(['1M', '3M', '6M', '1Y'] as const).map(p => (
                    <button key={p} className="period-btn" onClick={() => setPeriod(p)}
                      style={{ padding: '5px 12px', fontSize: '12px', color: period === p ? '#fff' : '#aaa', background: period === p ? '#000' : 'transparent', fontFamily: '"Times New Roman",serif' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              {candles.length > 0
                ? <PriceChart candles={candles} isPositive={isPositive} />
                : <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>}
            </div>

            {/* TWO COLUMN */}
            <div className="s3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'start', marginBottom: '64px' }}>

              {/* LEFT: Fundamentals + News */}
              <div>
                <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '16px' }}>Fundamentals</p>
                <div style={{ marginBottom: '48px' }}>
                  {fundamentals.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', borderBottom: '1px solid #f4f4f4' }}>
                      <span style={{ fontSize: '13px', color: '#888' }}>{f.label}</span>
                      <span style={{ fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>{f.value}</span>
                    </div>
                  ))}
                </div>

                {news.length > 0 && (
                  <>
                    <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '16px' }}>Recent News</p>
                    {news.map((n, i) => (
                      <a key={i} href={n.article_url} target="_blank" rel="noopener noreferrer" className="news-row">
                        <div style={{ padding: '16px 0', borderBottom: '1px solid #f4f4f4', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                          {n.image_url && (
                            <img src={n.image_url} alt="" style={{ width: '68px', height: '48px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }}
                              onError={e => (e.currentTarget.style.display = 'none')} />
                          )}
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '14px', lineHeight: '1.5', marginBottom: '5px' }}>{n.title}</p>
                            <p style={{ fontSize: '11px', color: '#aaa' }}>
                              {n.publisher?.name} · {new Date(n.published_utc).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </a>
                    ))}
                  </>
                )}
              </div>

              {/* RIGHT: Quick Summary + AI */}
              <div>
                <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '16px' }}>Quick Summary</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '36px' }}>
                  {quickSummary.map((item, i) => (
                    <div key={i} style={{ padding: '14px 16px', border: '1px solid #f0f0f0', background: '#fafafa' }}>
                      <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '6px' }}>{item.label}</p>
                      <p style={{ fontSize: '20px', fontWeight: '400' }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Company Description */}
                {details.description && (
                  <div style={{ marginBottom: '32px', padding: '20px 24px', border: '1px solid #f0f0f0', background: '#fafafa' }}>
                    <p style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: '10px' }}>About</p>
                    <p style={{ fontSize: '13px', lineHeight: '1.8', color: '#555' }}>
                      {details.description.length > 400 ? details.description.slice(0, 400) + '...' : details.description}
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa' }}>AI Analysis</p>
                  {!aiDone && (
                    <button className="ai-btn" onClick={generateAnalysis} disabled={aiLoading}
                      style={{ fontSize: '13px', padding: '8px 18px', background: aiLoading ? '#f5f5f5' : '#000', color: aiLoading ? '#aaa' : '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {aiLoading ? <><Spinner size={14} />분석 중...</> : 'Claude로 분석 생성'}
                    </button>
                  )}
                </div>
                {aiAnalysis ? (
                  <div style={{ padding: '24px 28px', border: '1px solid #e8e8e8', borderLeft: '3px solid #000' }}>
                    {renderAiText(aiAnalysis)}
                    <p style={{ fontSize: '11px', color: '#ccc', marginTop: '16px' }}>* AI 분석은 참고용이며, 투자 권유가 아닙니다.</p>
                  </div>
                ) : (
                  <div style={{ padding: '24px 28px', border: '1px solid #e8e8e8', borderLeft: '3px solid #f0f0f0', minHeight: '100px', display: 'flex', alignItems: 'center' }}>
                    {aiLoading
                      ? <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}><Spinner /><span style={{ fontSize: '14px', color: '#aaa' }}>Claude가 분석 중입니다...</span></div>
                      : <p style={{ fontSize: '14px', color: '#bbb' }}>위 버튼을 눌러 AI 종목 분석을 확인하세요.</p>}
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