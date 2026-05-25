import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

// ── URL helpers (local: Vite proxy, prod: Vercel edge function) ──
const isDev = import.meta.env.DEV
function yq1(path: string) {
  return isDev
    ? `/yq1${path}`
    : `/api/yahoo-proxy?url=${encodeURIComponent('https://query1.finance.yahoo.com' + path)}`
}
function yq2(path: string) {
  return isDev
    ? `/yq2${path}`
    : `/api/yahoo-proxy?url=${encodeURIComponent('https://query2.finance.yahoo.com' + path)}`
}

// ── Safe value extractor ──
function rv(obj: any, ...keys: string[]): any {
  let v = obj
  for (const k of keys) { if (v == null) return null; v = v[k] }
  return v?.raw ?? v ?? null
}
function fmtNum(v: any, prefix = '', suffix = '', digits = 2): string {
  const n = Number(v)
  if (v == null || isNaN(n)) return 'N/A'
  return prefix + n.toFixed(digits) + suffix
}
function fmtCap(v: any): string {
  const n = Number(v)
  if (!n || isNaN(n)) return 'N/A'
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M'
  return '$' + n.toFixed(0)
}
function periodLabel(period: string): string {
  const n = parseInt(period) || 0
  const d = new Date(); d.setMonth(d.getMonth() + n)
  return d.toLocaleDateString('en-US', { month: 'short' })
}

// ── Types ──
interface Candle { t: number; c: number }
interface NewsItem { title: string; publisher: string; link: string; providerPublishTime: number; thumbnail?: string }
interface RecommendTrend { period: string; strongBuy: number; buy: number; hold: number; sell: number; strongSell: number }
interface UpDowngrade { firm: string; toGrade: string; fromGrade: string; action: string; epochGradeDate: number }

function Spinner({ size = 24 }: { size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', border: '2px solid #e8e8e8', borderTopColor: '#000', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
}

// ── Price Chart ──
function PriceChart({ candles, isPositive }: { candles: Candle[]; isPositive: boolean }) {
  if (!candles.length) return null
  const W = 1000, H = 220, pad = { top: 16, right: 16, bottom: 32, left: 64 }
  const prices = candles.map(c => c.c)
  const minP = Math.min(...prices), maxP = Math.max(...prices), range = maxP - minP || 1
  const minT = candles[0].t, maxT = candles[candles.length - 1].t
  const sx = (t: number) => pad.left + ((t - minT) / (maxT - minT || 1)) * (W - pad.left - pad.right)
  const sy = (p: number) => pad.top + ((maxP - p) / range) * (H - pad.top - pad.bottom)
  const pts = candles.map(c => `${sx(c.t).toFixed(1)},${sy(c.c).toFixed(1)}`).join(' ')
  const areaPts = `${sx(minT)},${H - pad.bottom} ${pts} ${sx(maxT)},${H - pad.bottom}`
  const color = isPositive ? '#16a34a' : '#ff3b30'
  const step = Math.floor(candles.length / 4)
  const xIdx = [0, step, step * 2, step * 3, candles.length - 1].filter((i, j, a) => a.indexOf(i) === j && i < candles.length)
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
      <polygon points={areaPts} fill="url(#cg)" />
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

// ── Price Target Bar ──
function PriceTargetBar({ low, avg, high, current }: { low: number; avg: number; high: number; current: number }) {
  if (!low || !high || low >= high) return null
  const total = high - low
  const avgPct = ((avg - low) / total) * 100
  const currPct = Math.min(Math.max(((current - low) / total) * 100, 0), 100)
  const upside = current ? (((avg - current) / current) * 100).toFixed(1) : null
  return (
    <div>
      <div style={{ position: 'relative', height: '6px', background: '#f0f0f0', borderRadius: '3px', margin: '36px 0 8px' }}>
        <div style={{ position: 'absolute', left: `${avgPct}%`, transform: 'translateX(-50%)', top: '-22px', background: '#000', color: '#fff', fontSize: '11px', padding: '2px 7px', borderRadius: '2px', whiteSpace: 'nowrap' }}>
          ${avg.toFixed(2)} <span style={{ opacity: 0.6, fontSize: '10px' }}>Avg</span>
        </div>
        <div style={{ position: 'absolute', left: `${avgPct}%`, transform: 'translateX(-50%)', width: '10px', height: '10px', borderRadius: '50%', background: '#000', top: '-2px' }} />
        <div style={{ position: 'absolute', left: `${currPct}%`, transform: 'translateX(-50%)', width: '8px', height: '8px', borderRadius: '50%', background: '#3B82F6', border: '2px solid #fff', boxShadow: '0 0 0 1.5px #3B82F6', top: '-1px' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#aaa' }}>
        <span><b style={{ color: '#000', fontSize: '13px' }}>${low.toFixed(2)}</b><br />Low</span>
        <span style={{ textAlign: 'right' }}><b style={{ color: '#000', fontSize: '13px' }}>${high.toFixed(2)}</b><br />High</span>
      </div>
      <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        {[
          { label: 'Average', val: `$${avg.toFixed(2)}` },
          { label: 'Current', val: `$${current.toFixed(2)}`, color: '#3B82F6' },
          { label: 'Upside', val: upside ? `${upside}%` : 'N/A', color: upside && Number(upside) >= 0 ? '#16a34a' : '#ff3b30' },
        ].map((item, i) => (
          <div key={i} style={{ textAlign: 'center', padding: '10px', background: '#f9f9f9' }}>
            <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>{item.label}</p>
            <p style={{ fontSize: '16px', color: item.color ?? '#000' }}>{item.val}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Recommend Bar Chart ──
function RecommendChart({ data }: { data: RecommendTrend[] }) {
  if (!data.length) return null
  const show = [...data].reverse().slice(0, 3)
  const maxTotal = Math.max(...show.map(d => d.strongBuy + d.buy + d.hold + d.sell + d.strongSell)) || 1
  const W = 300, H = 160, barW = 52, gap = 50, padB = 24, padT = 16
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: '300px', height: 'auto', display: 'block' }}>
      {show.map((d, i) => {
        const x = 24 + i * (barW + gap)
        const segs = [
          { v: d.strongBuy, color: '#15803d' },
          { v: d.buy, color: '#4ade80' },
          { v: d.hold, color: '#fbbf24' },
          { v: d.sell + d.strongSell, color: '#ff3b30' },
        ]
        const totalH = H - padB - padT
        let yOff = H - padB
        const total = segs.reduce((s, g) => s + g.v, 0)
        return (
          <g key={i}>
            {segs.map((seg, j) => {
              if (!seg.v) return null
              const bH = (seg.v / maxTotal) * totalH
              yOff -= bH; const y = yOff
              return (
                <g key={j}>
                  <rect x={x} y={y} width={barW} height={bH} fill={seg.color} />
                  {bH > 14 && <text x={x + barW / 2} y={y + bH / 2 + 4} textAnchor="middle" fontSize="11" fill="#fff" fontWeight="600">{seg.v}</text>}
                </g>
              )
            })}
            <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#aaa">{periodLabel(d.period)}</text>
            <text x={x + barW / 2} y={H - padB - (total / maxTotal) * totalH - 6} textAnchor="middle" fontSize="11" fill="#555">{total}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Main Component ──
export default function Stock() {
  const { ticker } = useParams<{ ticker: string }>()
  const navigate = useNavigate()
  const symbol = ticker?.toUpperCase() || ''

  // Data state
  const [summary, setSummary] = useState<any>(null)
  const [candles, setCandles] = useState<Candle[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [peers, setPeers] = useState<string[]>([])
  const [recTrend, setRecTrend] = useState<RecommendTrend[]>([])
  const [upgrades, setUpgrades] = useState<UpDowngrade[]>([])
  const [period, setPeriod] = useState<'1mo' | '3mo' | '6mo' | '1y'>('3mo')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aiAnalysis, setAiAnalysis] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDone, setAiDone] = useState(false)
  const [searchQuery, setSearchQuery] = useState(symbol)

  const fetchCandles = useCallback(async (sym: string, range: string) => {
    try {
      const res = await fetch(yq1(`/v8/finance/chart/${sym}?interval=1d&range=${range}`))
      const data = await res.json()
      const result = data?.chart?.result?.[0]
      if (!result) return
      const ts: number[] = result.timestamp || []
      const close: number[] = result.indicators?.quote?.[0]?.close || []
      const pairs = ts.map((t, i) => ({ t, c: close[i] })).filter(p => p.c != null)
      setCandles(pairs)
    } catch {}
  }, [])

  useEffect(() => { setSearchQuery(symbol); if (symbol) loadData() }, [symbol])
  useEffect(() => { if (symbol) fetchCandles(symbol, period) }, [period, symbol])

  const loadData = async () => {
    setLoading(true); setError('')
    setSummary(null); setCandles([]); setNews([])
    setPeers([]); setRecTrend([]); setUpgrades([])
    setAiAnalysis(''); setAiDone(false)

    try {
      const modules = 'price,summaryDetail,defaultKeyStatistics,financialData,recommendationTrend,upgradeDowngradeHistory,assetProfile'
      const [sumRes, newsRes, peersRes] = await Promise.allSettled([
        fetch(yq1(`/v10/finance/quoteSummary/${symbol}?modules=${modules}`)).then(r => r.json()),
        fetch(yq1(`/v1/finance/search?q=${symbol}&newsCount=8&quotesCount=0`)).then(r => r.json()),
        fetch(yq2(`/v6/finance/recommendationsbyticker?symbols=${symbol}`)).then(r => r.json()),
      ])

      if (sumRes.status === 'fulfilled') {
        const result = sumRes.value?.quoteSummary?.result?.[0]
        if (!result) { setError('찾을 수 없는 종목입니다.'); setLoading(false); return }
        setSummary(result)
        // Recommendation trend
        const trend = result.recommendationTrend?.trend || []
        setRecTrend(trend)
        // Upgrades
        const hist = result.upgradeDowngradeHistory?.history || []
        setUpgrades(hist.slice(0, 1))
      } else {
        setError('데이터를 불러오지 못했습니다.'); setLoading(false); return
      }

      if (newsRes.status === 'fulfilled') {
        const items = newsRes.value?.news || []
        setNews(items.map((n: any) => ({
          title: n.title,
          publisher: n.publisher,
          link: n.link,
          providerPublishTime: n.providerPublishTime,
          thumbnail: n.thumbnail?.resolutions?.[0]?.url,
        })))
      }

      if (peersRes.status === 'fulfilled') {
        const recommended = peersRes.value?.finance?.result?.[0]?.recommendedSymbols || []
        setPeers(recommended.map((p: any) => p.symbol).filter((s: string) => s !== symbol).slice(0, 8))
      }

      await fetchCandles(symbol, '3mo')
    } catch { setError('데이터를 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }

  const generateAnalysis = async () => {
    if (!summary || aiLoading) return
    setAiLoading(true); setAiAnalysis(''); setAiDone(false)

    const price = summary.price
    const fin = summary.financialData
    const stat = summary.defaultKeyStatistics
    const det = summary.summaryDetail

    const prompt = `다음은 ${rv(price, 'longName') || rv(price, 'shortName')}(${symbol})의 최신 재무 데이터입니다.

현재가: $${rv(price, 'regularMarketPrice')} (${rv(price, 'regularMarketChangePercent') > 0 ? '+' : ''}${(rv(price, 'regularMarketChangePercent') * 100).toFixed(2)}%)
시가총액: ${fmtCap(rv(price, 'marketCap'))}
섹터/산업: ${rv(summary.assetProfile, 'sector')} / ${rv(summary.assetProfile, 'industry')}
P/E (TTM): ${fmtNum(rv(det, 'trailingPE'))}
EPS (TTM): $${fmtNum(rv(stat, 'trailingEps'))}
52주 고/저: $${fmtNum(rv(det, 'fiftyTwoWeekHigh'))} / $${fmtNum(rv(det, 'fiftyTwoWeekLow'))}
배당수익률: ${rv(det, 'dividendYield') ? (rv(det, 'dividendYield') * 100).toFixed(2) + '%' : 'N/A'}
ROE: ${rv(fin, 'returnOnEquity') ? (rv(fin, 'returnOnEquity') * 100).toFixed(1) + '%' : 'N/A'}
매출성장률 YoY: ${rv(fin, 'revenueGrowth') ? (rv(fin, 'revenueGrowth') * 100).toFixed(1) + '%' : 'N/A'}
애널리스트 목표주가: $${fmtNum(rv(fin, 'targetMeanPrice'))} (Low $${fmtNum(rv(fin, 'targetLowPrice'))} / High $${fmtNum(rv(fin, 'targetHighPrice'))})
애널리스트 권고: ${rv(fin, 'recommendationKey') || 'N/A'}

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

  // Derived values
  const price = summary?.price
  const fin = summary?.financialData
  const stat = summary?.defaultKeyStatistics
  const det = summary?.summaryDetail
  const currentPrice: number = rv(price, 'regularMarketPrice') ?? 0
  const change: number = rv(price, 'regularMarketChange') ?? 0
  const changePct: number = rv(price, 'regularMarketChangePercent') ?? 0
  const isPositive = changePct >= 0
  const priceColor = isPositive ? '#16a34a' : '#ff3b30'

  const fundamentals = summary ? [
    { label: 'P/E Ratio (TTM)',  value: fmtNum(rv(det, 'trailingPE')) },
    { label: 'Forward P/E',      value: fmtNum(rv(det, 'forwardPE')) },
    { label: 'EPS (TTM)',        value: fmtNum(rv(stat, 'trailingEps'), '$') },
    { label: 'P/B Ratio',        value: fmtNum(rv(stat, 'priceToBook')) },
    { label: '52W High',         value: fmtNum(rv(det, 'fiftyTwoWeekHigh'), '$') },
    { label: '52W Low',          value: fmtNum(rv(det, 'fiftyTwoWeekLow'), '$') },
    { label: 'ROE',              value: rv(fin, 'returnOnEquity') != null ? (rv(fin, 'returnOnEquity') * 100).toFixed(1) + '%' : 'N/A' },
    { label: 'Revenue Growth',   value: rv(fin, 'revenueGrowth') != null ? (rv(fin, 'revenueGrowth') * 100).toFixed(1) + '%' : 'N/A' },
    { label: 'Gross Margin',     value: rv(fin, 'grossMargins') != null ? (rv(fin, 'grossMargins') * 100).toFixed(1) + '%' : 'N/A' },
    { label: 'Beta (5Y)',        value: fmtNum(rv(det, 'beta')) },
  ] : []

  const quickSummary = summary ? [
    { label: 'Market Cap',      value: fmtCap(rv(price, 'marketCap')) },
    { label: 'P/E Ratio',       value: fmtNum(rv(det, 'trailingPE')) },
    { label: 'EPS (TTM)',        value: fmtNum(rv(stat, 'trailingEps'), '$') },
    { label: 'ROE',             value: rv(fin, 'returnOnEquity') != null ? (rv(fin, 'returnOnEquity') * 100).toFixed(1) + '%' : 'N/A' },
    { label: 'Dividend Yield',  value: rv(det, 'dividendYield') != null ? (rv(det, 'dividendYield') * 100).toFixed(2) + '%' : 'N/A' },
    { label: 'Revenue Growth',  value: rv(fin, 'revenueGrowth') != null ? (rv(fin, 'revenueGrowth') * 100).toFixed(1) + '%' : 'N/A' },
    { label: 'Beta (5Y)',       value: fmtNum(rv(det, 'beta')) },
    { label: '52W Position',    value: (() => { const h = rv(det, 'fiftyTwoWeekHigh'), l = rv(det, 'fiftyTwoWeekLow'); return h && l ? Math.round(((currentPrice - l) / (h - l)) * 100) + '%' : 'N/A' })() },
  ] : []

  const renderAiText = (text: string) =>
    text.split('\n').map((line, i) => {
      if (!line.trim()) return <div key={i} style={{ height: '10px' }} />
      const isBold = line.startsWith('**')
      const html = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      return <p key={i} dangerouslySetInnerHTML={{ __html: html }}
        style={{ fontSize: '14px', lineHeight: '1.85', color: isBold ? '#000' : '#444', margin: '0 0 4px', fontWeight: isBold ? '600' : '400' }} />
    })

  const latestUpgrade = upgrades[0]
  const hasAnalystInsights = (rv(fin, 'targetMeanPrice') != null) || recTrend.length > 0 || !!latestUpgrade

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
        ) : summary && (
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 48px 120px' }}>

            {/* HEADER */}
            <div className="s1" style={{ marginBottom: '36px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <div>
                    <p style={{ fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa', marginBottom: '3px' }}>
                      {symbol} · {rv(price, 'exchangeName')} · {rv(summary.assetProfile, 'industry')}
                    </p>
                    <h1 style={{ fontSize: '32px', fontWeight: '400', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                      {rv(price, 'longName') || rv(price, 'shortName') || symbol}
                    </h1>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
                  <span style={{ fontSize: '48px', fontWeight: '400', letterSpacing: '-0.02em' }}>${currentPrice.toFixed(2)}</span>
                  <span style={{ fontSize: '18px', color: priceColor }}>
                    {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{(changePct * 100).toFixed(2)}%)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0', marginTop: '14px', flexWrap: 'wrap', borderTop: '1px solid #f0f0f0', paddingTop: '14px' }}>
                  {[
                    { label: 'Open',       value: `$${fmtNum(rv(price, 'regularMarketOpen'))}` },
                    { label: 'High',       value: `$${fmtNum(rv(price, 'regularMarketDayHigh'))}` },
                    { label: 'Low',        value: `$${fmtNum(rv(price, 'regularMarketDayLow'))}` },
                    { label: 'Prev Close', value: `$${fmtNum(rv(price, 'regularMarketPreviousClose'))}` },
                    { label: 'Market Cap', value: fmtCap(rv(price, 'marketCap')) },
                  ].map((s, i) => (
                    <div key={i} style={{ paddingRight: '28px', marginRight: '28px', borderRight: i < 4 ? '1px solid #f0f0f0' : 'none' }}>
                      <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '3px' }}>{s.label}</p>
                      <p style={{ fontSize: '14px', fontWeight: '500' }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {peers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '300px', justifyContent: 'flex-end' }}>
                  {peers.map(p => (
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
                  {(['1mo', '3mo', '6mo', '1y'] as const).map(p => (
                    <button key={p} className="period-btn" onClick={() => setPeriod(p)}
                      style={{ padding: '5px 12px', fontSize: '12px', color: period === p ? '#fff' : '#aaa', background: period === p ? '#000' : 'transparent', fontFamily: '"Times New Roman",serif' }}>
                      {p === '1mo' ? '1M' : p === '3mo' ? '3M' : p === '6mo' ? '6M' : '1Y'}
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
                      <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" className="news-row">
                        <div style={{ padding: '16px 0', borderBottom: '1px solid #f4f4f4', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                          {n.thumbnail && (
                            <img src={n.thumbnail} alt="" style={{ width: '68px', height: '48px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }}
                              onError={e => (e.currentTarget.style.display = 'none')} />
                          )}
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '14px', lineHeight: '1.5', marginBottom: '5px' }}>{n.title}</p>
                            <p style={{ fontSize: '11px', color: '#aaa' }}>
                              {n.publisher} · {new Date(n.providerPublishTime * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </a>
                    ))}
                  </>
                )}
              </div>

              {/* RIGHT: Quick Summary + AI Analysis */}
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

            {/* ANALYST INSIGHTS */}
            {hasAnalystInsights && (
              <div className="s4">
                <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '20px' }}>
                  Analyst Insights: {symbol}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>

                  {/* Price Target */}
                  <div style={{ padding: '24px', border: '1px solid #e8e8e8' }}>
                    <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Analyst Price Targets</p>
                    <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                      {rv(fin, 'numberOfAnalystOpinions') ? `Based on ${rv(fin, 'numberOfAnalystOpinions')} analysts` : ''}
                    </p>
                    {rv(fin, 'targetMeanPrice') ? (
                      <PriceTargetBar
                        low={rv(fin, 'targetLowPrice')}
                        avg={rv(fin, 'targetMeanPrice')}
                        high={rv(fin, 'targetHighPrice')}
                        current={currentPrice}
                      />
                    ) : <p style={{ fontSize: '13px', color: '#bbb', marginTop: '20px' }}>데이터 없음</p>}
                  </div>

                  {/* Recommendations */}
                  <div style={{ padding: '24px', border: '1px solid #e8e8e8' }}>
                    <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '20px' }}>Analyst Recommendations</p>
                    {recTrend.length > 0 ? (
                      <>
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end' }}>
                          <RecommendChart data={recTrend} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', flexShrink: 0 }}>
                            {[{ label: 'Strong Buy', color: '#15803d' }, { label: 'Buy', color: '#4ade80' }, { label: 'Hold', color: '#fbbf24' }, { label: 'Sell', color: '#ff3b30' }].map(item => (
                              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: item.color, flexShrink: 0 }} />
                                <span style={{ fontSize: '11px', color: '#555' }}>{item.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {recTrend[0] && (() => {
                          const r = recTrend[0]
                          const total = r.strongBuy + r.buy + r.hold + r.sell + r.strongSell
                          const bullish = r.strongBuy + r.buy
                          const pct = total ? Math.round((bullish / total) * 100) : 0
                          return (
                            <div style={{ marginTop: '16px', padding: '10px 14px', background: '#f9f9f9', fontSize: '12px', color: '#555' }}>
                              최신 기준: 총 {total}명 중 Buy 이상 <b style={{ color: pct >= 60 ? '#16a34a' : '#ff3b30' }}>{pct}%</b>
                            </div>
                          )
                        })()}
                      </>
                    ) : <p style={{ fontSize: '13px', color: '#bbb' }}>데이터 없음</p>}
                  </div>

                  {/* Latest Rating */}
                  <div style={{ padding: '24px', border: '1px solid #e8e8e8' }}>
                    <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '20px' }}>Latest Rating</p>
                    {latestUpgrade ? (
                      <div>
                        {[
                          { label: 'Date',   value: new Date(latestUpgrade.epochGradeDate * 1000).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) },
                          { label: 'Analyst', value: latestUpgrade.firm },
                          { label: 'Action',  value: latestUpgrade.action?.charAt(0).toUpperCase() + latestUpgrade.action?.slice(1) || '—' },
                          { label: 'From',    value: latestUpgrade.fromGrade || '—' },
                          { label: 'Rating',  value: latestUpgrade.toGrade || '—' },
                        ].map((row, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f4f4f4' }}>
                            <span style={{ fontSize: '13px', color: '#aaa' }}>{row.label}</span>
                            <span style={{ fontSize: '13px', fontWeight: row.label === 'Rating' ? '500' : '400',
                              color: row.label === 'Action'
                                ? (latestUpgrade.action?.toLowerCase().includes('up') ? '#16a34a' : latestUpgrade.action?.toLowerCase().includes('down') ? '#ff3b30' : '#000')
                                : '#000' }}>
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '13px', color: '#bbb' }}>최근 등급 변경 없음</p>
                    )}

                    {/* Recommendation key badge */}
                    {rv(fin, 'recommendationKey') && (
                      <div style={{ marginTop: '20px', textAlign: 'center', padding: '12px', background: '#f9f9f9' }}>
                        <p style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Consensus</p>
                        <p style={{ fontSize: '16px', fontWeight: '500', textTransform: 'capitalize', color: rv(fin, 'recommendationKey')?.includes('buy') ? '#16a34a' : rv(fin, 'recommendationKey')?.includes('sell') ? '#ff3b30' : '#000' }}>
                          {rv(fin, 'recommendationKey')?.replace('_', ' ')}
                        </p>
                      </div>
                    )}
                  </div>
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