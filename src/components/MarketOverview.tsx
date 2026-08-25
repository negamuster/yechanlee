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
  { label: 'VIX',      sub: 'VIXY', ticker: 'VIXY' },
]

interface Row { o: number; c: number }
type DataMap = Record<string, Row>

const CACHE_KEY = 'anthracite_market_overview'
const CACHE_TTL = 1000 * 60 * 60 * 4 // 4시간

function dateStr(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

async function fetchGroupedForDate(date: string): Promise<{ stocks: any[]; crypto: any[] } | null> {
  try {
    const [stocksRes, cryptoRes] = await Promise.allSettled([
      fetch(poly(`/v2/aggs/grouped/locale/us/market/stocks/${date}?adjusted=true`)).then(r => r.json()),
      fetch(poly(`/v2/aggs/grouped/locale/global/market/crypto/${date}?adjusted=true`)).then(r => r.json()),
    ])
    const stocks = stocksRes.status === 'fulfilled' ? stocksRes.value?.results || [] : []
    const crypto = cryptoRes.status === 'fulfilled' ? cryptoRes.value?.results || [] : []
    return { stocks, crypto }
  } catch {
    return null
  }
}

async function loadMarketData(): Promise<DataMap | null> {
  // 캐시 확인
  try {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Date.now() - parsed.ts < CACHE_TTL) return parsed.data
    }
  } catch {}

  // 최근 거래일 탐색 (주말/휴일 대비 최대 6일 전까지)
  for (let i = 0; i < 6; i++) {
    const date = dateStr(i)
    const result = await fetchGroupedForDate(date)
    if (result && (result.stocks.length > 0 || result.crypto.length > 0)) {
      const map: DataMap = {}
      const wantedTickers = new Set(INDEX_LIST.map(t => t.ticker))
      for (const row of [...result.stocks, ...result.crypto]) {
        if (wantedTickers.has(row.T)) map[row.T] = { o: row.o, c: row.c }
      }
      if (Object.keys(map).length > 0) {
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: map })) } catch {}
        return map
      }
    }
  }
  return null
}

interface MarketOverviewProps {
  onSelect: (ticker: string) => void
  variant?: 'cards' | 'ticker'
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

  // ── Ticker variant: thin persistent strip (Yahoo Finance style) ──
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
                <div style={{ height: '10px', width: '70px', background: '#f0f0f0', borderRadius: '2px' }} />
              </div>
            ))
          ) : failed ? (
            <p style={{ fontSize: '12px', color: '#bbb', padding: '10px 20px' }}>시장 데이터를 불러오지 못했습니다.</p>
          ) : (
            INDEX_LIST.map(item => {
              const row = data?.[item.ticker]
              if (!row) return null
              const change = row.c - row.o
              const changePct = row.o ? (change / row.o) * 100 : 0
              const isPositive = change >= 0
              const color = isPositive ? '#16a34a' : '#ff3b30'
              return (
                <div
                  key={item.ticker}
                  className="mo-ticker-item"
                  onClick={() => onSelect(item.isCrypto ? item.sub : item.ticker)}
                  style={{ display: 'flex', alignItems: 'baseline', gap: '8px', padding: '10px 20px', borderRight: '1px solid #f0f0f0', flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  <span style={{ fontSize: '12px', color: '#888' }}>{item.label}</span>
                  <span style={{ fontSize: '13px', color: '#000', fontVariantNumeric: 'tabular-nums' }}>${row.c.toFixed(2)}</span>
                  <span style={{ fontSize: '12px', color, fontVariantNumeric: 'tabular-nums' }}>
                    {isPositive ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  // ── Cards variant: default larger card layout ──
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
            const change = row.c - row.o
            const changePct = row.o ? (change / row.o) * 100 : 0
            const isPositive = change >= 0
            const color = isPositive ? '#16a34a' : '#ff3b30'
            return (
              <div
                key={item.ticker}
                className="mo-card"
                onClick={() => onSelect(item.isCrypto ? item.sub : item.ticker)}
                style={{ minWidth: '150px', padding: '18px 20px', border: '1px solid #e8e8e8', flexShrink: 0 }}
              >
                <p style={{ fontSize: '11px', letterSpacing: '0.03em', color: '#aaa', marginBottom: '10px', whiteSpace: 'nowrap' }}>
                  {item.label} <span style={{ color: '#ccc' }}>· {item.sub}</span>
                </p>
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