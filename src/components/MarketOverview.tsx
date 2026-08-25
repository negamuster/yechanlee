import { useEffect, useState } from 'react'

const KEY = import.meta.env.VITE_POLYGON_KEY
const poly = (path: string) =>
  `https://api.polygon.io${path}${path.includes('?') ? '&' : '?'}apiKey=${KEY}`

interface IndexItem {
  label: string
  sub: string
  ticker: string
  isCrypto?: boolean
}

const INDEX_LIST: IndexItem[] = [
  { label: '나스닥 100',      sub: 'QQQ',  ticker: 'QQQ' },
  { label: 'S&P 500',        sub: 'SPY',  ticker: 'SPY' },
  { label: '다우존스',        sub: 'DIA',  ticker: 'DIA' },
  { label: '러셀 2000',       sub: 'IWM',  ticker: 'IWM' },
  { label: '필라델피아 반도체', sub: 'SOXX', ticker: 'SOXX' },
  { label: '금',              sub: 'GLD',  ticker: 'GLD' },
  { label: '은',              sub: 'SLV',  ticker: 'SLV' },
  { label: '비트코인',        sub: 'BTC',  ticker: 'X:BTCUSD', isCrypto: true },
  { label: 'WTI 원유',        sub: 'USO',  ticker: 'USO' },
  { label: 'VIX 변동성',      sub: 'VIXY', ticker: 'VIXY' },
]

interface Row { o: number; c: number; prevClose?: number; series: number[] }
type DataMap = Record<string, Row>

const CACHE_KEY = 'anthracite_market_overview_v2'
const CACHE_TTL = 1000 * 60 * 60 * 4 // 4시간

function dateStr(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function fetchStocksGrouped(date: string): Promise<any[] | null> {
  try {
    const res = await fetch(poly(`/v2/aggs/grouped/locale/us/market/stocks/${date}?adjusted=true`))
    if (!res.ok) return null
    const data = await res.json()
    return data?.results || null
  } catch {
    return null
  }
}

async function fetchCryptoGrouped(date: string): Promise<any[] | null> {
  try {
    const res = await fetch(poly(`/v2/aggs/grouped/locale/global/market/crypto/${date}?adjusted=true`))
    if (!res.ok) return null
    const data = await res.json()
    return data?.results || null
  } catch {
    return null
  }
}

// 무료 플랜 분당 5회 제한 안에서 안전하게: 주식 그룹 데이터 최대 3거래일치 + 크립토 1회 = 총 4회 호출
async function loadMarketData(): Promise<DataMap | null> {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Date.now() - parsed.ts < CACHE_TTL) return parsed.data
    }
  } catch {}

  const wantedTickers = new Set(INDEX_LIST.filter(t => !t.isCrypto).map(t => t.ticker))
  const validDays: { date: string; rows: any[] }[] = []

  // 최근 거래일 최대 3개 수집 (주말/휴일 스킵), 순차 호출 + 딜레이
  for (let i = 1; i <= 8 && validDays.length < 3; i++) {
    const date = dateStr(i)
    const rows = await fetchStocksGrouped(date)
    if (rows && rows.length > 0) {
      const filtered = rows.filter((r: any) => wantedTickers.has(r.T))
      if (filtered.length > 0) validDays.push({ date, rows: filtered })
    }
    await sleep(350)
  }

  if (validDays.length === 0) return null

  // oldest -> newest 정렬
  validDays.sort((a, b) => a.date.localeCompare(b.date))
  const latest = validDays[validDays.length - 1]
  const prev = validDays.length > 1 ? validDays[validDays.length - 2] : null

  const map: DataMap = {}
  for (const item of INDEX_LIST) {
    if (item.isCrypto) continue
    const latestRow = latest.rows.find((r: any) => r.T === item.ticker)
    if (!latestRow) continue
    const prevRow = prev?.rows.find((r: any) => r.T === item.ticker)
    const series = validDays
      .map(d => d.rows.find((r: any) => r.T === item.ticker)?.c)
      .filter((v): v is number => v != null)
    map[item.ticker] = { o: latestRow.o, c: latestRow.c, prevClose: prevRow?.c, series }
  }

  // 크립토(BTC): 최신 거래일 기준 1회만 호출
  await sleep(350)
  const cryptoRows = await fetchCryptoGrouped(latest.date)
  if (cryptoRows) {
    const btc = cryptoRows.find((r: any) => r.T === 'X:BTCUSD')
    if (btc) map['X:BTCUSD'] = { o: btc.o, c: btc.c, series: [btc.o, btc.c] }
  }

  if (Object.keys(map).length === 0) return null

  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: map })) } catch {}
  return map
}

function Sparkline({ series, color, w = 44, h = 18 }: { series: number[]; color: string; w?: number; h?: number }) {
  if (series.length < 2) return null
  const min = Math.min(...series)
  const max = Math.max(...series)
  const range = max - min || 1
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface MarketOverviewProps {
  onSelect: (ticker: string) => void
  variant?: 'cards' | 'ticker' | 'sidebar'
}

export default function MarketOverview({ onSelect, variant = 'cards' }: MarketOverviewProps) {
  const [data, setData] = useState<DataMap | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let mounted = true
    loadMarketData().then(map => {
      if (!mounted) return
      if (map) setData(map)
      else setFailed(true)
      setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const getChangePct = (row: Row) => {
    if (row.prevClose) return ((row.c - row.prevClose) / row.prevClose) * 100
    return row.o ? ((row.c - row.o) / row.o) * 100 : 0
  }

  // ── Ticker variant: Yahoo Finance 스타일 얇은 상시 스트립 (스파크라인 포함) ──
  if (variant === 'ticker') {
    return (
      <div style={{ width: '100%' }}>
        <style>{`
          .mo-ticker-scroll { display: flex; overflow-x: auto; scrollbar-width: none; }
          .mo-ticker-scroll::-webkit-scrollbar { display: none; }
          .mo-ticker-item { transition: opacity 0.15s ease; cursor: pointer; }
          .mo-ticker-item:hover { opacity: 0.5; }
        `}</style>
        <div className="mo-ticker-scroll">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ padding: '10px 20px', borderRight: '1px solid #f0f0f0', flexShrink: 0 }}>
                <div style={{ height: '10px', width: '90px', background: '#f0f0f0', borderRadius: '2px' }} />
              </div>
            ))
          ) : failed ? (
            <p style={{ fontSize: '12px', color: '#bbb', padding: '10px 20px' }}>시장 데이터를 불러오지 못했습니다.</p>
          ) : (
            INDEX_LIST.map(item => {
              const row = data?.[item.ticker]
              if (!row) return null
              const changePct = getChangePct(row)
              const isPositive = changePct >= 0
              const color = isPositive ? '#16a34a' : '#ff3b30'
              return (
                <div
                  key={item.ticker}
                  className="mo-ticker-item"
                  onClick={() => onSelect(item.isCrypto ? item.sub : item.ticker)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', borderRight: '1px solid #f0f0f0', flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#888' }}>{item.label}</span>
                      <span style={{ fontSize: '13px', color: '#000', fontVariantNumeric: 'tabular-nums' }}>${row.c.toFixed(2)}</span>
                    </div>
                    <span style={{ fontSize: '11px', color, fontVariantNumeric: 'tabular-nums' }}>
                      {isPositive ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
                    </span>
                  </div>
                  <Sparkline series={row.series} color={color} />
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  // ── Sidebar variant: 세로 리스트, 큰 카드 + 차트 ──
  if (variant === 'sidebar') {
    return (
      <div style={{ width: '100%' }}>
        <style>{`
          .mo-sidebar-item { transition: opacity 0.15s ease; }
          .mo-sidebar-item:hover { opacity: 0.5; }
        `}</style>
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ padding: '18px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ height: '12px', width: '50%', background: '#f0f0f0', borderRadius: '2px', marginBottom: '10px' }} />
              <div style={{ height: '20px', width: '35%', background: '#f0f0f0', borderRadius: '2px' }} />
            </div>
          ))
        ) : failed ? (
          <p style={{ fontSize: '13px', color: '#bbb', padding: '20px 0' }}>시장 데이터를 불러오지 못했습니다.</p>
        ) : (
          INDEX_LIST.map(item => {
            const row = data?.[item.ticker]
            if (!row) return null
            const changePct = getChangePct(row)
            const isPositive = changePct >= 0
            const color = isPositive ? '#16a34a' : '#ff3b30'
            return (
              <div
                key={item.ticker}
                className="mo-sidebar-item"
                onClick={() => onSelect(item.isCrypto ? item.sub : item.ticker)}
                style={{ padding: '20px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '6px' }}>
                    {item.label} <span style={{ color: '#ccc' }}>· {item.sub}</span>
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{ fontSize: '22px', fontWeight: '400', fontVariantNumeric: 'tabular-nums' }}>${row.c.toFixed(2)}</span>
                    <span style={{ fontSize: '13px', color, fontVariantNumeric: 'tabular-nums' }}>
                      {isPositive ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
                    </span>
                  </div>
                </div>
                <Sparkline series={row.series} color={color} w={72} h={30} />
              </div>
            )
          })
        )}
      </div>
    )
  }

  // ── Cards variant: 큰 카드 레이아웃 ──
  return (
    <div style={{ width: '100%' }}>
      <style>{`
        .mo-scroll { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
        .mo-scroll::-webkit-scrollbar { display: none; }
        .mo-card { transition: opacity 0.15s ease, border-color 0.15s ease; cursor: pointer; }
        .mo-card:hover { opacity: 0.6; }
      `}</style>

      <div className="mo-scroll">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ minWidth: '150px', padding: '18px 20px', border: '1px solid #f0f0f0', flexShrink: 0 }}>
              <div style={{ height: '11px', width: '60%', background: '#f0f0f0', borderRadius: '2px', marginBottom: '14px' }} />
              <div style={{ height: '20px', width: '75%', background: '#f0f0f0', borderRadius: '2px', marginBottom: '10px' }} />
              <div style={{ height: '11px', width: '40%', background: '#f5f5f5', borderRadius: '2px' }} />
            </div>
          ))
        ) : failed ? (
          <p style={{ fontSize: '13px', color: '#bbb', padding: '20px 0' }}>시장 데이터를 불러오지 못했습니다.</p>
        ) : (
          INDEX_LIST.map(item => {
            const row = data?.[item.ticker]
            if (!row) {
              return (
                <div key={item.ticker} style={{ minWidth: '150px', padding: '18px 20px', border: '1px solid #f0f0f0', flexShrink: 0 }}>
                  <p style={{ fontSize: '11px', color: '#ccc', marginBottom: '10px' }}>{item.label}</p>
                  <p style={{ fontSize: '13px', color: '#ccc' }}>N/A</p>
                </div>
              )
            }
            const changePct = getChangePct(row)
            const isPositive = changePct >= 0
            const color = isPositive ? '#16a34a' : '#ff3b30'
            return (
              <div
                key={item.ticker}
                className="mo-card"
                onClick={() => onSelect(item.isCrypto ? item.sub : item.ticker)}
                style={{ minWidth: '150px', padding: '18px 20px', border: '1px solid #e8e8e8', flexShrink: 0 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p style={{ fontSize: '11px', letterSpacing: '0.03em', color: '#aaa', marginBottom: '10px', whiteSpace: 'nowrap' }}>
                    {item.label} <span style={{ color: '#ccc' }}>· {item.sub}</span>
                  </p>
                  <Sparkline series={row.series} color={color} />
                </div>
                <p style={{ fontSize: '20px', fontWeight: '400', marginBottom: '6px', fontVariantNumeric: 'tabular-nums' }}>
                  ${row.c.toFixed(2)}
                </p>
                <p style={{ fontSize: '13px', color, fontVariantNumeric: 'tabular-nums' }}>
                  {isPositive ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
                </p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}