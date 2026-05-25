import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY
const fh = (path: string) => `https://finnhub.io/api/v1/${path}&token=${FINNHUB_KEY}`

interface Quote { c: number; d: number; dp: number; h: number; l: number; o: number; pc: number }
interface Profile { name: string; ticker: string; finnhubIndustry: string; marketCapitalization: number; shareOutstanding: number; logo: string; weburl: string; country: string; currency: string; exchange: string }
interface Metrics { metric: Record<string, number | string | null> }
interface NewsItem { headline: string; summary: string; url: string; datetime: number; source: string; image: string }
interface Candle { t: number; c: number; o: number; h: number; l: number }
interface PriceTarget { targetHigh: number; targetLow: number; targetMean: number; lastUpdated: string }
interface RecommendTrend { buy: number; hold: number; sell: number; strongBuy: number; strongSell: number; period: string }
interface UpDowngrade { company: string; fromGrade: string; toGrade: string; action: string; gradeDate: string }

function fmtCap(v: number | null | undefined): string {
  if (!v) return 'N/A'
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2) + 'T'
  if (v >= 1_000) return '$' + (v / 1_000).toFixed(1) + 'B'
  return '$' + v.toFixed(0) + 'M'
}
function fmt(n: number | string | null | undefined, prefix = '', suffix = '', digits = 2): string {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return 'N/A'
  return prefix + Number(n).toFixed(digits) + suffix
}
function Spinner({ size = 24 }: { size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', border: '2px solid #e8e8e8', borderTopColor: '#000', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
}

// ── Price Chart ──────────────────────────────────────────────
function PriceChart({ candles, isPositive }: { candles: Candle[]; isPositive: boolean }) {
  if (!candles.length) return null
  const W = 1000, H = 220, pad = { top: 16, right: 16, bottom: 32, left: 64 }
  const prices = candles.map(c => c.c)
  const minP = Math.min(...prices), maxP = Math.max(...prices), range = maxP - minP || 1
  const minT = Math.min(...candles.map(c => c.t)), maxT = Math.max(...candles.map(c => c.t))
  const sx = (t: number) => pad.left + ((t - minT) / (maxT - minT || 1)) * (W - pad.left - pad.right)
  const sy = (p: number) => pad.top + ((maxP - p) / range) * (H - pad.top - pad.bottom)
  const pts = candles.map(c => `${sx(c.t).toFixed(1)},${sy(c.c).toFixed(1)}`).join(' ')
  const areaPts = `${sx(minT)},${H - pad.bottom} ${pts} ${sx(maxT)},${H - pad.bottom}`
  const color = isPositive ? '#16a34a' : '#ff3b30'
  const step = Math.floor(candles.length / 4)
  const xLabels = [0, step, step * 2, step * 3, candles.length - 1].filter((i, idx, arr) => arr.indexOf(i) === idx && i < candles.length)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
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
      <polygon points={areaPts} fill="url(#chartGrad)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      {xLabels.map(i => (
        <text key={i} x={sx(candles[i].t)} y={H - 8} textAnchor="middle" fontSize="10" fill="#bbb">
          {new Date(candles[i].t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </text>
      ))}
      <circle cx={sx(candles[candles.length - 1].t)} cy={sy(candles[candles.length - 1].c)} r="3" fill={color} />
    </svg>
  )
}

// ── Price Target Visualization ───────────────────────────────
function PriceTargetBar({ target, currentPrice }: { target: PriceTarget; currentPrice: number }) {
  const { targetLow: low, targetMean: avg, targetHigh: high } = target
  if (!low || !high || low >= high) return null
  const total = high - low
  const avgPct = ((avg - low) / total) * 100
  const currPct = Math.min(Math.max(((currentPrice - low) / total) * 100, 0), 100)
  const currOutside = currentPrice > high || currentPrice < low

  return (
    <div>
      <div style={{ position: 'relative', height: '6px', background: '#f0f0f0', borderRadius: '3px', margin: '32px 0 8px' }}>
        {/* Filled range */}
        <div style={{ position: 'absolute', left: 0, width: '100%', height: '100%', background: 'linear-gradient(to right, #e8e8e8, #16a34a22, #e8e8e8)', borderRadius: '3px' }} />
        {/* Average marker */}
        <div style={{ position: 'absolute', left: `${avgPct}%`, transform: 'translateX(-50%)', top: '-20px', background: '#000', color: '#fff', fontSize: '11px', padding: '2px 6px', whiteSpace: 'nowrap', borderRadius: '2px' }}>
          ${avg.toFixed(2)} <span style={{ fontSize: '10px', opacity: 0.7 }}>Avg</span>
        </div>
        <div style={{ position: 'absolute', left: `${avgPct}%`, transform: 'translateX(-50%)', width: '10px', height: '10px', borderRadius: '50%', background: '#000', top: '-2px' }} />
        {/* Current price marker */}
        {!currOutside && (
          <div style={{ position: 'absolute', left: `${currPct}%`, transform: 'translateX(-50%)', width: '8px', height: '8px', borderRadius: '50%', background: '#3B82F6', border: '2px solid #fff', boxShadow: '0 0 0 1px #3B82F6', top: '-1px' }} />
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#888' }}>
        <span><b style={{ color: '#000' }}>${low.toFixed(2)}</b><br /><span style={{ fontSize: '11px' }}>Low</span></span>
        <span style={{ textAlign: 'right' }}><b style={{ color: '#000' }}>${high.toFixed(2)}</b><br /><span style={{ fontSize: '11px' }}>High</span></span>
      </div>
      {currOutside && (
        <p style={{ fontSize: '12px', color: '#3B82F6', marginTop: '8px' }}>
          Current ${currentPrice.toFixed(2)} — {currentPrice > high ? 'above target range' : 'below target range'}
        </p>
      )}
    </div>
  )
}

// ── Recommendation Bar Chart ─────────────────────────────────
function RecommendChart({ data }: { data: RecommendTrend[] }) {
  if (!data.length) return null
  const last3 = data.slice(0, 3).reverse()
  const maxTotal = Math.max(...last3.map(d => d.strongBuy + d.buy + d.hold + d.sell + d.strongSell)) || 1
  const W = 340, H = 160, barW = 60, gap = 60, padB = 24, padT = 16

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: '340px', height: 'auto', display: 'block' }}>
      {last3.map((d, i) => {
        const x = 30 + i * (barW + gap)
        const segments = [
          { v: d.strongBuy, color: '#15803d' },
          { v: d.buy, color: '#4ade80' },
          { v: d.hold, color: '#fbbf24' },
          { v: d.sell + d.strongSell, color: '#ff3b30' },
        ]
        const totalH = H - padB - padT
        let yOff = H - padB
        const total = segments.reduce((s, seg) => s + seg.v, 0)
        return (
          <g key={i}>
            {segments.map((seg, j) => {
              if (!seg.v) return null
              const bH = (seg.v / maxTotal) * totalH
              yOff -= bH
              const y = yOff
              return (
                <g key={j}>
                  <rect x={x} y={y} width={barW} height={bH} fill={seg.color} />
                  {seg.v >= 1 && bH > 14 && (
                    <text x={x + barW / 2} y={y + bH / 2 + 4} textAnchor="middle" fontSize="11" fill="#fff" fontWeight="600">{seg.v}</text>
                  )}
                </g>
              )
              yOff = y
            })}
            <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#aaa">
              {new Date(d.period).toLocaleDateString('en-US', { month: 'short' })}
            </text>
            <text x={x + barW / 2} y={H - padB - (total / maxTotal) * totalH - 6} textAnchor="middle" fontSize="11" fill="#555">{total}</text>
          </g>
        )
      })}
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
  const [priceTarget, setPriceTarget] = useState<PriceTarget | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendTrend[]>([])
  const [upgrades, setUpgrades] = useState<UpDowngrade[]>([])
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
      if (data.s === 'ok' && data.t)
        setCandles(data.t.map((t: number, i: number) => ({ t, c: data.c[i], o: data.o[i], h: data.h[i], l: data.l[i] })))
    } catch {}
  }, [])

  useEffect(() => { setSearchQuery(symbol); if (symbol) loadData() }, [symbol])
  useEffect(() => { if (symbol) fetchCandles(symbol, periodDays[period]) }, [period, symbol])

  const loadData = async () => {
    setLoading(true); setError('')
    setQuote(null); setProfile(null); setMetrics(null)
    setNews([]); setPeers([]); setCandles([])
    setPriceTarget(null); setRecommendations([]); setUpgrades([])
    setAiAnalysis(''); setAiDone(false)

    const today = new Date()
    const from30 = new Date(today); from30.setDate(from30.getDate() - 30)
    const from180 = new Date(today); from180.setDate(from180.getDate() - 180)
    const toStr = today.toISOString().split('T')[0]
    const fromStr = from30.toISOString().split('T')[0]
    const from180Str = from180.toISOString().split('T')[0]

    try {
      const results = await Promise.allSettled([
        fetch(fh(`quote?symbol=${symbol}`)).then(r => r.json()),
        fetch(fh(`stock/profile2?symbol=${symbol}`)).then(r => r.json()),
        fetch(fh(`stock/metric?symbol=${symbol}&metric=all`)).then(r => r.json()),
        fetch(fh(`company-news?symbol=${symbol}&from=${fromStr}&to=${toStr}`)).then(r => r.json()),
        fetch(fh(`stock/peers?symbol=${symbol}`)).then(r => r.json()),
        fetch(fh(`stock/price-target?symbol=${symbol}`)).then(r => r.json()),
        fetch(fh(`stock/recommendation?symbol=${symbol}`)).then(r => r.json()),
        fetch(fh(`stock/upgrade-downgrade?symbol=${symbol}&from=${from180Str}`)).then(r => r.json()),
      ])
      const [quoteR, profileR, metricsR, newsR, peersR, ptR, recR, upR] = results

      let q: Quote | null = null
      if (quoteR.status === 'fulfilled') { q = quoteR.value; setQuote(q) }
      if (profileR.status === 'fulfilled') setProfile(profileR.value)
      if (metricsR.status === 'fulfilled') setMetrics(metricsR.value)
      if (newsR.status === 'fulfilled') setNews((newsR.value || []).slice(0, 6))
      if (peersR.status === 'fulfilled') setPeers((peersR.value || []).filter((p: string) => p !== symbol).slice(0, 8))
      if (ptR.status === 'fulfilled' && ptR.value?.targetMean) setPriceTarget(ptR.value)
      if (recR.status === 'fulfilled') setRecommendations((recR.value || []).slice(0, 3))
      if (upR.status === 'fulfilled') setUpgrades((upR.value || []).slice(0, 1))

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

현재가: $${quote.c} (${quote.dp > 0 ? '+' : ''}${quote.dp?.toFixed(2)}%)
52주 고/저: $${m['52WeekHigh'] ?? 'N/A'} / $${m['52WeekLow'] ?? 'N/A'}
P/E (TTM): ${m['peBasicExclExtraTTM'] ?? 'N/A'}
EPS (TTM): $${m['epsTTM'] ?? 'N/A'}
시가총액: ${fmtCap(profile.marketCapitalization)}
섹터: ${profile.finnhubIndustry ?? 'N/A'}
배당수익률: ${m['dividendYieldIndicatedAnnual'] ?? 0}%
ROE (TTM): ${m['roeTTM'] ?? 'N/A'}%
매출성장률 YoY: ${m['revenueGrowthTTMYoy'] ?? 'N/A'}%
${priceTarget ? `애널리스트 목표주가: 평균 $${priceTarget.targetMean?.toFixed(2)} (Low $${priceTarget.targetLow} / High $${priceTarget.targetHigh})` : ''}

위 데이터를 바탕으로 이 종목에 대해 한국어로 분석해주세요. 아래 구조를 따르되, 각 항목은 자연스러운 문장으로 작성하세요:

**현재 상황**
(현재 주가 위치, 최근 주가 흐름, 시장 환경 2~3문장)

**핵심 강점**
(재무 지표 기반 강점 2가지, 각 1~2문장)

**주요 리스크**
(주의해야 할 리스크 2가지, 각 1~2문장)

**투자자 관점에서 주목할 점**
(밸류에이션, 성장성, 배당, 애널리스트 평가 등 종합 시각 2~3문장)

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
    { label: 'P/E Ratio (TTM)', value: fmt(metrics.metric['peBasicExclExtraTTM']) },
    { label: 'P/B (Annual)',    value: fmt(metrics.metric['pbAnnual']) },
    { label: 'EPS (TTM)',       value: fmt(metrics.metric['epsTTM'], '$') },
    { label: 'Dividend Yield', value: fmt(metrics.metric['dividendYieldIndicatedAnnual'], '', '%') },
    { label: '52W High',        value: fmt(metrics.metric['52WeekHigh'], '$') },
    { label: '52W Low',         value: fmt(metrics.metric['52WeekLow'], '$') },
    { label: 'ROE (TTM)',       value: fmt(metrics.metric['roeTTM'], '', '%') },
    { label: 'Revenue Growth',  value: fmt(metrics.metric['revenueGrowthTTMYoy'], '', '%') },
    { label: 'Beta (5Y)',       value: fmt(metrics.metric['beta']) },
    { label: 'Debt/Equity',     value: fmt(metrics.metric['totalDebt/totalEquityAnnual'], '', '%') },
  ]

  const renderAiText = (text: string) =>
    text.split('\n').map((line, i) => {
      if (!line.trim()) return <div key={i} style={{ height: '10px' }} />
      const isBold = line.startsWith('**')
      const html = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      return <p key={i} dangerouslySetInnerHTML={{ __html: html }}
        style={{ fontSize: '14px', lineHeight: '1.85', color: isBold ? '#000' : '#444', margin: '0 0 4px', fontWeight: isBold ? '600' : '400' }} />
    })

  const latestUpgrade = upgrades[0]

  return (
    <>
      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);} }
        @keyframes spin { from{transform:rotate(0deg);}to{transform:rotate(360deg);} }
        .s1{opacity:0;animation:slideUp 0.6s ease forwards 0.05s;}
        .s2{opacity:0;animation:slideUp 0.6s ease forwards 0.15s;}
        .s3{opacity:0;animation:slideUp 0.6s ease forwards 0.25s;}
        .s4{opacity:0;animation:slideUp 0.6s ease forwards 0.35s;}
        .s5{opacity:0;animation:slideUp 0.6s ease forwards 0.45s;}
        .peer-chip{transition:opacity 0.15s;cursor:pointer;}
        .peer-chip:hover{opacity:0.4;}
        .news-row{transition:opacity 0.15s;cursor:pointer;text-decoration:none;color:inherit;display:block;}
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

                {/* Stats row — English */}
                <div style={{ display: 'flex', gap: '0', marginTop: '14px', flexWrap: 'wrap', borderTop: '1px solid #f0f0f0', paddingTop: '14px' }}>
                  {[
                    { label: 'Open',       value: `$${quote?.o.toFixed(2)}` },
                    { label: 'High',       value: `$${quote?.h.toFixed(2)}` },
                    { label: 'Low',        value: `$${quote?.l.toFixed(2)}` },
                    { label: 'Prev Close', value: `$${quote?.pc.toFixed(2)}` },
                    { label: 'Market Cap', value: fmtCap(profile?.marketCapitalization) },
                  ].map((s, i) => (
                    <div key={i} style={{ paddingRight: '28px', marginRight: '28px', borderRight: i < 4 ? '1px solid #f0f0f0' : 'none' }}>
                      <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px' }}>{s.label}</p>
                      <p style={{ fontSize: '14px', fontWeight: '500' }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Peers */}
              {peers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '300px', justifyContent: 'flex-end' }}>
                  {peers.map(p => (
                    <span key={p} className="peer-chip" onClick={() => navigate(`/stock/${p}`)}
                      style={{ fontSize: '12px', padding: '6px 12px', border: '1px solid #e8e8e8', color: '#666' }}>{p}</span>
                  ))}
                </div>
              )}
            </div>

            {/* ── CHART ── */}
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

            {/* ── TWO COLUMN ── */}
            <div className="s3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'start', marginBottom: '64px' }}>

              {/* LEFT: Fundamentals + News */}
              <div>
                <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '16px' }}>Fundamentals</p>
                <div style={{ marginBottom: '48px' }}>
                  {fundamentals.map((f, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid #f4f4f4' }}>
                      <span style={{ fontSize: '13px', color: '#888' }}>{f.label}</span>
                      <span style={{ fontSize: '14px', fontVariantNumeric: 'tabular-nums' }}>{f.value}</span>
                    </div>
                  ))}
                </div>

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
                            <p style={{ fontSize: '11px', color: '#aaa' }}>{n.source} · {new Date(n.datetime * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                          </div>
                        </div>
                      </a>
                    ))}
                  </>
                )}
              </div>

              {/* RIGHT: Quick Summary + AI Analysis */}
              <div>
                {/* Quick Summary */}
                <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '16px' }}>Quick Summary</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '36px' }}>
                  {metrics && quote && [
                    { label: 'Market Cap',      value: fmtCap(profile?.marketCapitalization) },
                    { label: 'P/E Ratio',       value: fmt(metrics.metric['peBasicExclExtraTTM']) },
                    { label: 'EPS (TTM)',        value: fmt(metrics.metric['epsTTM'], '$') },
                    { label: 'ROE',             value: fmt(metrics.metric['roeTTM'], '', '%') },
                    { label: 'Dividend Yield',  value: fmt(metrics.metric['dividendYieldIndicatedAnnual'], '', '%') },
                    { label: 'Revenue Growth',  value: fmt(metrics.metric['revenueGrowthTTMYoy'], '', '%') },
                    { label: 'Beta (5Y)',        value: fmt(metrics.metric['beta']) },
                    { label: '52W Position', value: (() => { const h = Number(metrics.metric['52WeekHigh']), l = Number(metrics.metric['52WeekLow']); return h && l ? Math.round(((quote.c - l) / (h - l)) * 100) + '%' : 'N/A' })() },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: '14px 16px', border: '1px solid #f0f0f0', background: '#fafafa' }}>
                      <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '6px' }}>{item.label}</p>
                      <p style={{ fontSize: '20px', fontWeight: '400' }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* AI Analysis */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa' }}>AI Analysis</p>
                  {!aiDone && (
                    <button className="ai-btn" onClick={generateAnalysis} disabled={aiLoading}
                      style={{ fontSize: '13px', padding: '8px 18px', background: aiLoading ? '#f5f5f5' : '#000', color: aiLoading ? '#aaa' : '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {aiLoading ? <><Spinner size={14} /> 분석 중...</> : 'Claude로 분석 생성'}
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

            {/* ── ANALYST INSIGHTS (full width) ── */}
            {(priceTarget || recommendations.length > 0 || latestUpgrade) && (
              <div className="s4">
                <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '20px' }}>
                  Analyst Insights: {symbol}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: priceTarget && recommendations.length && latestUpgrade ? '1fr 1fr 1fr' : '1fr 1fr', gap: '24px' }}>

                  {/* Price Target */}
                  {priceTarget && (
                    <div style={{ padding: '24px', border: '1px solid #e8e8e8' }}>
                      <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Analyst Price Targets</p>
                      <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>
                        {priceTarget.lastUpdated ? new Date(priceTarget.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                      </p>
                      <PriceTargetBar target={priceTarget} currentPrice={quote?.c ?? 0} />
                      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#f9f9f9', borderRadius: '2px' }}>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: '11px', color: '#aaa' }}>Average</p>
                          <p style={{ fontSize: '18px' }}>${priceTarget.targetMean?.toFixed(2)}</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: '11px', color: '#aaa' }}>Current</p>
                          <p style={{ fontSize: '18px', color: isPositive ? '#16a34a' : '#ff3b30' }}>${quote?.c.toFixed(2)}</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: '11px', color: '#aaa' }}>Upside</p>
                          <p style={{ fontSize: '18px', color: (priceTarget.targetMean - (quote?.c ?? 0)) >= 0 ? '#16a34a' : '#ff3b30' }}>
                            {quote?.c ? `${(((priceTarget.targetMean - quote.c) / quote.c) * 100).toFixed(1)}%` : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {recommendations.length > 0 && (
                    <div style={{ padding: '24px', border: '1px solid #e8e8e8' }}>
                      <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '20px' }}>Analyst Recommendations</p>
                      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end' }}>
                        <RecommendChart data={recommendations} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                          {[
                            { label: 'Strong Buy', color: '#15803d' },
                            { label: 'Buy',         color: '#4ade80' },
                            { label: 'Hold',        color: '#fbbf24' },
                            { label: 'Sell',        color: '#ff3b30' },
                          ].map(item => (
                            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: item.color, flexShrink: 0 }} />
                              <span style={{ fontSize: '12px', color: '#555' }}>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Latest month summary */}
                      {recommendations[0] && (() => {
                        const r = recommendations[0]
                        const total = r.strongBuy + r.buy + r.hold + r.sell + r.strongSell
                        const bullish = r.strongBuy + r.buy
                        const pct = total ? Math.round((bullish / total) * 100) : 0
                        return (
                          <div style={{ marginTop: '20px', padding: '12px', background: '#f9f9f9', fontSize: '13px', color: '#555' }}>
                            최신 기준 ({new Date(r.period).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}): 총 {total}명 중 Buy 이상 <b style={{ color: pct >= 60 ? '#16a34a' : '#ff3b30' }}>{pct}%</b>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {/* Latest Rating */}
                  {latestUpgrade && (
                    <div style={{ padding: '24px', border: '1px solid #e8e8e8' }}>
                      <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '20px' }}>Latest Rating</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        {[
                          { label: 'Date',          value: new Date(latestUpgrade.gradeDate).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) },
                          { label: 'Analyst',        value: latestUpgrade.company },
                          { label: 'Action',         value: latestUpgrade.action?.charAt(0).toUpperCase() + latestUpgrade.action?.slice(1) || '—' },
                          { label: 'From',           value: latestUpgrade.fromGrade || '—' },
                          { label: 'Rating',         value: latestUpgrade.toGrade || '—' },
                        ].map((row, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f4f4f4' }}>
                            <span style={{ fontSize: '13px', color: '#aaa' }}>{row.label}</span>
                            <span style={{ fontSize: '13px', fontWeight: row.label === 'Rating' ? '500' : '400',
                              color: row.label === 'Action'
                                ? (latestUpgrade.action?.toLowerCase().includes('up') ? '#16a34a' : latestUpgrade.action?.toLowerCase().includes('down') ? '#ff3b30' : '#000')
                                : '#000'
                            }}>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <footer style={{ borderTop: '1px solid #e8e8e8', padding: '32px 48px', fontSize: '12px', color: '#aaa' }}>
          <span>Anthracite © 2026</span>
        </footer>
      </div>
    </>
  )
}