import { useReadArticles } from '../hooks/useReadArticles'
import { WatchButton } from '../components/SavedItemsProvider'
import { useState } from 'react'
import { useStockSnapshot } from '../hooks/useStockSnapshot'
import { quoteFromBars } from '../lib/stockSnapshot'
import './Stock.css'
import { useNavigate, useParams } from 'react-router-dom'

function fmtCap(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return 'N/A'
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
  if (v == null || !Number.isFinite(v)) return 'N/A'
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
          {new Date(candles[i].t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}
        </text>
      ))}
      <circle cx={sx(candles[candles.length - 1].t)} cy={sy(candles[candles.length - 1].c)} r="3" fill={color} />
    </svg>
  )
}

// ── Main Component ───────────────────────────────────────────
export default function Stock() {
  const { isRead, mark } = useReadArticles()
  const { ticker } = useParams<{ ticker: string }>()
  const navigate = useNavigate()
  const symbol = ticker?.toUpperCase() || ''

  const { snapshot, loading, error, refresh } = useStockSnapshot(symbol)
  const details = snapshot?.details
  const news = snapshot?.news || []
  const related = snapshot?.related || []
  const financials = snapshot?.financials || []
  const bars = snapshot?.bars || []
  const quote = quoteFromBars(bars)
  const prevDay = quote.latest
  const [period, setPeriod] = useState<'1M' | '3M' | '6M' | '1Y'>('3M')
  const periodDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }
  const chartStart = (prevDay?.t || 0) - periodDays[period] * 86400000
  const candles = bars.filter(b => b.t >= chartStart).map(b => ({ t: b.t / 1000, c: b.c }))

  // Derived financials
  const fin0 = financials[0]?.financials
  const fin1 = financials[1]?.financials
  const eps = fin0?.income_statement?.diluted_earnings_per_share?.value ?? null
  const revenue = fin0?.income_statement?.revenues?.value ?? null
  const revenue1 = fin1?.income_statement?.revenues?.value ?? null
  const netIncome = fin0?.income_statement?.net_income_loss?.value ?? null
  const equity = fin0?.balance_sheet?.equity?.value ?? null
  const liabilities = fin0?.balance_sheet?.liabilities?.value ?? null
  const currentPrice = prevDay?.c ?? null
  const pe = eps > 0 && currentPrice !== null ? currentPrice / eps : null
  const roe = netIncome != null && equity > 0 ? (netIncome / equity) * 100 : null
  const debtEquity = liabilities != null && equity > 0 ? liabilities / equity : null
  const revenueGrowth = revenue != null && revenue1 > 0 ? ((revenue - revenue1) / revenue1) * 100 : null
  const week52High = quote.high
  const week52Low = quote.low
  const change = quote.change
  const changePct = quote.changePct
  const isPositive = (change ?? 0) >= 0
  const priceColor = change === null ? '#666' : isPositive ? '#16a34a' : '#ff3b30'

  const fundamentals = [
    { label: 'P/E Ratio',       value: pe != null ? pe.toFixed(1) : 'N/A' },
    { label: 'EPS (Annual)',    value: eps != null ? '$' + eps.toFixed(2) : 'N/A' },
    { label: 'Revenue',         value: fmtLarge(revenue) },
    { label: 'Net Income',      value: fmtLarge(netIncome) },
    { label: 'ROE (기말 자본 기준)',             value: roe != null ? roe.toFixed(1) + '%' : 'N/A' },
    { label: 'Revenue Growth',  value: revenueGrowth != null ? revenueGrowth.toFixed(1) + '%' : 'N/A' },
    { label: '총부채 / 자기자본',   value: debtEquity != null ? debtEquity.toFixed(2) + 'x' : 'N/A' },
    { label: '52주 고가 (조정)',        value: week52High != null ? '$' + week52High.toFixed(2) : 'N/A' },
    { label: '52주 저가 (조정)',         value: week52Low != null ? '$' + week52Low.toFixed(2) : 'N/A' },
    { label: 'Market Cap',      value: fmtCap(details?.market_cap) },
  ]

  const quickSummary = [
    { label: 'Market Cap',     value: fmtCap(details?.market_cap) },
    { label: 'P/E Ratio',      value: pe != null ? pe.toFixed(1) : 'N/A' },
    { label: 'EPS (Annual)',   value: eps != null ? '$' + eps.toFixed(2) : 'N/A' },
    { label: 'ROE (기말 자본 기준)',            value: roe != null ? roe.toFixed(1) + '%' : 'N/A' },
    { label: 'Revenue Growth', value: revenueGrowth != null ? revenueGrowth.toFixed(1) + '%' : 'N/A' },
    { label: 'Net Income',     value: fmtLarge(netIncome) },
    { label: '52주 고가 (조정)',       value: week52High != null ? '$' + week52High.toFixed(2) : 'N/A' },
    { label: '52주 범위 내 위치',   value: currentPrice !== null && week52High !== null && week52Low !== null && week52High > week52Low ? Math.round(((currentPrice - week52Low) / (week52High - week52Low)) * 100) + '%' : 'N/A' },
  ]

  const logoUrl = details?.branding?.icon_url ? `/api/stock-data?logo=${encodeURIComponent(symbol)}` : null

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
      `}</style>

      <div style={{ backgroundColor: '#fff', minHeight: '100vh', fontFamily: 'var(--font-ui)', color: '#000' }}>

        {/* NAV */}

        {loading && !snapshot ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '20px' }}>
            <Spinner size={28} /><p style={{ fontSize: '14px', color: '#aaa' }}>{symbol} 데이터를 불러오는 중...</p>
          </div>
        ) : error && !snapshot ? (
          <div style={{ textAlign: 'center', padding: '100px 48px' }}>
            <p style={{ fontSize: '20px', marginBottom: '12px' }}>{error}</p>
            <p style={{ fontSize: '14px', color: '#aaa' }}>티커 예시: AAPL, NVDA, MSFT, GOOGL, TSLA</p><button type="button" onClick={refresh}>다시 조회</button>
          </div>
        ) : details && (
          <div className="stock-page-content">
            <div className="stock-data-status">
              <button type="button" onClick={refresh} disabled={loading}>{loading ? '조회 중…' : '새로고침'}</button>
              <p>{quote.tradingDate} 미국 거래일 · 일별 집계 종가 · 실시간 아님 · USD · Polygon / Massive</p>
              <p>비교 기준: {quote.previousDate || '미확인'} 종가 · 주식분할 조정 데이터</p>
              {snapshot && <p>조회 시각: {new Date(snapshot.fetchedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST · 5분마다 확인</p>}
              {error && <p role="status">{error}</p>}
              {!!snapshot?.issues.length && <p role="status">일부 자료 조회 실패: {snapshot.issues.join(', ')} · 해당 항목은 미확인으로 표시합니다.</p>}
            </div>

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
                    <div style={{ marginTop: 12 }}><WatchButton ticker={symbol} name={details.name} /></div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
                  <span style={{ fontSize: '48px', fontWeight: '400', letterSpacing: '-0.02em' }}>{currentPrice === null ? 'N/A' : '$' + currentPrice.toFixed(2)}</span>
                  <span style={{ fontSize: '18px', color: priceColor }}>
                    {change === null || changePct === null ? '전 거래일 대비 미확인' : `${isPositive ? '+' : ''}${change.toFixed(2)} (${isPositive ? '+' : ''}${changePct.toFixed(2)}%)`}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0', marginTop: '14px', flexWrap: 'wrap', borderTop: '1px solid #f0f0f0', paddingTop: '14px' }}>
                  {[
                    { label: 'Open',       value: fmtNum(prevDay?.o, '$') },
                    { label: 'High',       value: fmtNum(prevDay?.h, '$') },
                    { label: 'Low',        value: fmtNum(prevDay?.l, '$') },
                    { label: 'Prev Close', value: fmtNum(quote.previous?.c, '$') },
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
            <div className="s2 stock-chart" style={{ marginBottom: '48px', border: '1px solid #e8e8e8', padding: '20px 24px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa' }}>Price Chart</p>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {(['1M', '3M', '6M', '1Y'] as const).map(p => (
                    <button key={p} className="period-btn" onClick={() => setPeriod(p)}
                      style={{ padding: '5px 12px', fontSize: '12px', color: period === p ? '#fff' : '#aaa', background: period === p ? '#000' : 'transparent', fontFamily: 'var(--font-ui)' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              {candles.length > 0
                ? <PriceChart candles={candles} isPositive={isPositive} />
                : <p role="status">이 기간의 차트 자료가 없습니다.</p>}
            </div>

            {/* TWO COLUMN */}
            <div className="s3 stock-columns">

              {/* LEFT: Fundamentals + News */}
              <div>
                <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '16px' }}>Fundamentals</p>
                <p className="stock-data-note">연간 재무 기간: {financials[0]?.start_date || '미확인'} ~ {financials[0]?.end_date || '미확인'} · 제출일: {financials[0]?.filing_date || '미확인'}</p>
                <p className="stock-data-note">P/E는 위 종가 ÷ 최근 연간 희석 EPS입니다. ROE는 기말 자기자본 기준이며, 총부채 비율에는 이자부 차입금 외 부채도 포함합니다. 52주 고가·저가는 수집 기간의 일별 고가·저가 기준입니다. 신규 상장 등으로 52주 전체가 아닐 수 있습니다.</p>
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
                      <a key={i} onClick={() => mark(n.article_url)} onAuxClick={e => { if (e.button === 1) mark(n.article_url) }} href={n.article_url} target="_blank" rel="noopener noreferrer" className={`news-row${isRead(n.article_url) ? ' is-read' : ''}`}>
                        <div style={{ padding: '16px 0', borderBottom: '1px solid #f4f4f4', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                          {n.image_url && (
                            <img src={n.image_url} alt="" style={{ width: '68px', height: '48px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }}
                              onError={e => (e.currentTarget.style.display = 'none')} />
                          )}
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '14px', lineHeight: '1.5', marginBottom: '5px' }}>{n.title}</p>
                            <p style={{ fontSize: '11px', color: '#aaa' }}>
                              {n.publisher?.name} · {new Date(n.published_utc).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}
                            </p>
                          </div>
                        </div>
                      </a>
                    ))}
                  </>
                )}
              </div>

              {/* RIGHT: Quick Summary */}
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
