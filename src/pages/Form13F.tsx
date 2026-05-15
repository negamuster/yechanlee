import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const MANAGERS = [
  { name: 'Warren Buffett', firm: 'Berkshire Hathaway', cik: '0001067983' },
  { name: 'Michael Burry', firm: 'Scion Asset Management', cik: '0001649339' },
  { name: 'Cathie Wood', firm: 'ARK Invest', cik: '0001579982' },
  { name: 'Ray Dalio', firm: 'Bridgewater Associates', cik: '0001350694' },
  { name: 'BlackRock', firm: 'BlackRock Inc.', cik: '0001364742' },
  { name: 'Bill Ackman', firm: 'Pershing Square', cik: '0001336528' },
  { name: 'Jim Simons', firm: 'Renaissance Technologies', cik: '0001037389' },
  { name: 'Li Lu', firm: 'Himalaya Capital', cik: '0001709323' },
]

const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#F97316','#84CC16','#6366F1']

interface Holding {
  name: string
  shares: number
  value: number
  prevShares?: number
  pct?: number
}

interface FilingData {
  period: string
  holdings: Holding[]
  loading: boolean
  error: string | null
}

const proxy = (url: string) => `/api/sec-proxy?url=${encodeURIComponent(url)}`

function formatValue(v: number): string {
  if (v >= 1_000_000_000) return '$' + Math.round(v / 1_000_000_000).toLocaleString() + 'B'
  if (v >= 1_000_000) return '$' + Math.round(v / 1_000_000).toLocaleString() + 'M'
  if (v >= 1_000) return '$' + Math.round(v / 1_000).toLocaleString() + 'K'
  return '$' + Math.round(v).toLocaleString()
}

function formatShares(n: number): string {
  if (n >= 1_000_000) return Math.round(n / 1_000_000).toLocaleString() + 'M'
  if (n >= 1_000) return Math.round(n / 1_000).toLocaleString() + 'K'
  return Math.round(n).toLocaleString()
}

function ChangeTag({ curr, prev }: { curr: number; prev?: number }) {
  if (prev === undefined || prev === 0) return (
    <span style={{ fontSize: '11px', color: '#aaa', padding: '2px 8px', border: '1px solid #e8e8e8', borderRadius: '2px' }}>NEW</span>
  )
  const pct = ((curr - prev) / prev) * 100
  const up = pct > 0
  const color = up ? '#16a34a' : '#ff3b30'
  const bg = up ? 'rgba(22,163,74,0.06)' : 'rgba(255,59,48,0.06)'
  const border = up ? 'rgba(22,163,74,0.2)' : 'rgba(255,59,48,0.2)'
  return (
    <span style={{ fontSize: '11px', color, padding: '2px 8px', border: `1px solid ${border}`, borderRadius: '2px', background: bg }}>
      {up ? '+' : ''}{Math.round(pct)}%
    </span>
  )
}

function DonutChart({ holdings }: { holdings: Holding[] }) {
  const top10 = holdings.slice(0, 10)
  const total = top10.reduce((s, h) => s + h.value, 0)
  const R = 80, r = 48, cx = 100, cy = 100
  let angle = -Math.PI / 2
  const slices = top10.map((h, i) => {
    const pct = h.value / total
    const startAngle = angle
    angle += pct * 2 * Math.PI
    const endAngle = angle
    const x1 = cx + R * Math.cos(startAngle)
    const y1 = cy + R * Math.sin(startAngle)
    const x2 = cx + R * Math.cos(endAngle)
    const y2 = cy + R * Math.sin(endAngle)
    const ix1 = cx + r * Math.cos(endAngle)
    const iy1 = cy + r * Math.sin(endAngle)
    const ix2 = cx + r * Math.cos(startAngle)
    const iy2 = cy + r * Math.sin(startAngle)
    const large = pct > 0.5 ? 1 : 0
    const d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${r} ${r} 0 ${large} 0 ${ix2} ${iy2} Z`
    return { d, color: COLORS[i % COLORS.length], name: h.name, pct: Math.round(pct * 1000) / 10 }
  })

  return (
    <div style={{ display: 'flex', gap: '32px', alignItems: 'center', marginBottom: '40px' }}>
      <svg viewBox="0 0 200 200" style={{ width: '160px', flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} stroke="#fff" strokeWidth="1" />
        ))}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#555', flex: 1 }}>{s.name}</span>
            <span style={{ fontSize: '12px', color: '#aaa', fontVariantNumeric: 'tabular-nums' }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function parseInfoTable(xmlText: string): Map<string, Holding> {
  const map = new Map<string, Holding>()
  const cleaned = xmlText
    .replace(/<[a-zA-Z][a-zA-Z0-9]*:/g, '<')
    .replace(/<\/[a-zA-Z][a-zA-Z0-9]*:/g, '</')
  const parser = new DOMParser()
  const doc = parser.parseFromString(cleaned, 'application/xml')
  let entries = doc.querySelectorAll('infoTable')
  if (entries.length === 0) entries = doc.querySelectorAll('InfoTable')
  entries.forEach(entry => {
    const name = (entry.querySelector('nameOfIssuer, NAMEOFISSUER')?.textContent || '').trim()
    const shares = parseInt(entry.querySelector('sshPrnamt, SSHPRNAMT, shrQty, SHRQTY')?.textContent || '0') || 0
    const value = (parseInt(entry.querySelector('value, VALUE')?.textContent || '0') || 0) * 1000
    if (!name) return
    if (map.has(name)) {
      const e = map.get(name)!
      map.set(name, { name, shares: e.shares + shares, value: e.value + value })
    } else {
      map.set(name, { name, shares, value })
    }
  })
  return map
}

async function getXmlUrl(cikInt: number, accNum: string, primaryDoc: string): Promise<string> {
  const base = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accNum}`

  // 1. filing-index 페이지 파싱
  try {
    const res = await fetch(proxy(`${base}/${primaryDoc}`))
    const text = await res.text()
    const m = text.match(/href="([^"]*infotable[^"]*\.xml)"/i)
      || text.match(/href="([^"]*form13f[^"]*\.xml)"/i)
      || text.match(/href="([^"]*\.xml)"/i)
    if (m) return m[1].startsWith('http') ? m[1] : `https://www.sec.gov${m[1]}`
  } catch {}

  // 2. -index.htm 시도
  try {
    const res = await fetch(proxy(`${base}/${accNum}-index.htm`))
    const text = await res.text()
    const m = text.match(/href="([^"]*\.xml)"/i)
    if (m) return m[1].startsWith('http') ? m[1] : `https://www.sec.gov${m[1]}`
  } catch {}

  // 3. index.json 시도


  // 4. 공통 파일명 시도
  const names = ['form13fInfoTable.xml', 'infotable.xml', 'primary_doc.xml']
  for (const n of names) {
    try {
      const res = await fetch(proxy(`${base}/${n}`))
      if (res.ok) {
        const t = await res.text()
        if (t.includes('infoTable') || t.includes('InfoTable')) return `${base}/${n}`
      }
    } catch {}
  }

  return `${base}/form13fInfoTable.xml`
}

async function fetchLatest13F(cik: string): Promise<FilingData> {
  try {
    const subRes = await fetch(proxy(`https://data.sec.gov/submissions/CIK${cik}.json`))
    if (!subRes.ok) throw new Error('submissions fetch failed')
    const subData = await subRes.json()
    const filings = subData.filings?.recent
    if (!filings) throw new Error('no filings data')

    const forms: string[] = filings.form || []
    const dates: string[] = filings.reportDate || filings.filingDate || []
    const accNums: string[] = filings.accessionNumber || []
    const primaryDocs: string[] = filings.primaryDocument || []

    const indices13f = forms.reduce<number[]>((acc, f, i) => {
      if (f === '13F-HR') acc.push(i)
      return acc
    }, [])
    if (indices13f.length === 0) throw new Error('no 13F-HR filings found')

    const idx = indices13f[0]
    const idxPrev = indices13f.length > 1 ? indices13f[1] : undefined
    const period = dates[idx] || ''
    const accNum = accNums[idx].replace(/-/g, '')
    const cikInt = parseInt(cik)

    const xmlUrl = await getXmlUrl(cikInt, accNum, primaryDocs[idx])
    const xmlRes = await fetch(proxy(xmlUrl))
    if (!xmlRes.ok) throw new Error(`xml fetch failed: ${xmlUrl}`)
    const xmlText = await xmlRes.text()

    const holdingMap = parseInfoTable(xmlText)
    if (holdingMap.size === 0) throw new Error('no holdings parsed')

    const prevMap = new Map<string, number>()
    if (idxPrev !== undefined) {
      try {
        const prevAccNum = accNums[idxPrev].replace(/-/g, '')
        const prevXmlUrl = await getXmlUrl(cikInt, prevAccNum, primaryDocs[idxPrev])
        const prevXmlRes = await fetch(proxy(prevXmlUrl))
        const prevXmlText = await prevXmlRes.text()
        const pm = parseInfoTable(prevXmlText)
        pm.forEach((h, name) => prevMap.set(name, h.shares))
      } catch {}
    }

    const totalValue = Array.from(holdingMap.values()).reduce((s, h) => s + h.value, 0)
    const holdings: Holding[] = Array.from(holdingMap.values())
      .map(h => ({ ...h, prevShares: prevMap.get(h.name), pct: Math.round(h.value / totalValue * 1000) / 10 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 30)

    return { period, holdings, loading: false, error: null }
  } catch (e: any) {
    return { period: '', holdings: [], loading: false, error: e.message }
  }
}

export default function Form13F() {
  const navigate = useNavigate()
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [cache, setCache] = useState<Record<number, FilingData>>({})

  useEffect(() => {
    if (cache[selectedIdx]) return
    setCache(prev => ({ ...prev, [selectedIdx]: { period: '', holdings: [], loading: true, error: null } }))
    fetchLatest13F(MANAGERS[selectedIdx].cik).then(data => {
      setCache(prev => ({ ...prev, [selectedIdx]: data }))
    })
  }, [selectedIdx])

  const current = cache[selectedIdx]
  const manager = MANAGERS[selectedIdx]

  return (
    <>
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .page-title { opacity: 0; animation: slideUp 0.7s ease forwards 0.1s; }
        .page-desc  { opacity: 0; animation: slideUp 0.7s ease forwards 0.3s; }
        .page-section { opacity: 0; animation: slideUp 0.7s ease forwards 0.5s; }
        .mgr-btn { transition: all 0.15s ease; cursor: pointer; }
        .mgr-btn:hover { background: #f5f5f5 !important; }
        .table-row:hover { background: #fafafa; }
        .edgar-link { transition: opacity 0.15s; }
        .edgar-link:hover { opacity: 0.4; }
      `}</style>

      <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: '"Times New Roman", Times, serif', color: '#000' }}>
        <nav style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8e8e8' }}>
          <span onClick={() => navigate('/')} style={{ fontSize: '22px', fontWeight: '600', cursor: 'pointer' }}>Anthracite</span>
        </nav>

        <div style={{ maxWidth: '1060px', margin: '0 auto', padding: '80px 48px 120px' }}>
          <h1 className="page-title" style={{ fontSize: '52px', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '20px', lineHeight: '1.1' }}>Form 13F</h1>
          <p className="page-desc" style={{ fontSize: '18px', lineHeight: '1.85', color: '#444', maxWidth: '720px', marginBottom: '32px', textAlign: 'justify', wordBreak: 'keep-all' }}>
            미국에서 일정 규모 이상의 자산(AUM)을 운용하는 기관투자자는 분기마다 보유 주식을 미국 증권거래위원회(SEC)에 공개해야 하며, 이를 Form 13F라고 합니다. 이를 통해 주요 기관투자자들의 최신 포트폴리오와 보유 종목 변화를 확인할 수 있으며, 투자 비중과 신규 매수·매도 내역을 통해 기관 자금의 흐름과 시장에 대한 시각을 살펴볼 수 있습니다.
          </p>

          <div className="page-desc" style={{ padding: '20px 24px', border: '1px solid #e8e8e8', borderRadius: '4px', marginBottom: '64px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '4px' }}>주의사항</p>
            {[
              '최대 45일 지연 - 공시 시점과 실제 보유 시점에 차이가 있습니다.',
              '미국 상장 주식 중심 - 현금, 채권, 공매도(Short), 비상장 투자, 해외 주식 상당수는 포함되지 않습니다.',
              '복사 매매 주의 - 공시 데이터만으로 투자 결정을 내리는 것은 위험할 수 있습니다.',
            ].map((text, i) => <p key={i} style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>{text}</p>)}
          </div>

          <div className="page-section" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '48px', alignItems: 'start' }}>
            {/* 왼쪽 */}
            <div style={{ borderRight: '1px solid #e8e8e8', paddingRight: '40px' }}>
              <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '20px' }}>Investors</p>
              {MANAGERS.map((m, i) => (
                <div key={i} className="mgr-btn" onClick={() => setSelectedIdx(i)}
                  style={{ padding: '16px 18px', borderRadius: '4px', marginBottom: '4px', background: selectedIdx === i ? '#f5f5f5' : 'transparent', borderLeft: selectedIdx === i ? '2px solid #000' : '2px solid transparent' }}>
                  <p style={{ fontSize: '15px', fontWeight: selectedIdx === i ? '500' : '400', color: '#000', marginBottom: '3px' }}>{m.name}</p>
                  <p style={{ fontSize: '12px', color: '#aaa' }}>{m.firm}</p>
                </div>
              ))}
            </div>

            {/* 오른쪽 */}
            <div>
              <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: '400', marginBottom: '6px' }}>{manager.name}</h2>
                <p style={{ fontSize: '14px', color: '#aaa' }}>{manager.firm}</p>
                {current?.period && <p style={{ fontSize: '13px', color: '#aaa', marginTop: '6px' }}>최신 공시 기준: {current.period}</p>}
              </div>

              {!current || current.loading ? (
                <div style={{ padding: '64px 0', textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', color: '#aaa' }}>SEC EDGAR에서 데이터를 불러오는 중...</p>
                </div>
              ) : current.error ? (
                <div style={{ padding: '32px', border: '1px solid #e8e8e8', borderRadius: '4px' }}>
                  <p style={{ fontSize: '14px', color: '#aaa', marginBottom: '8px' }}>데이터를 불러오지 못했습니다.</p>
                  <p style={{ fontSize: '12px', color: '#ccc', marginBottom: '16px' }}>{current.error}</p>
                  <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${manager.cik}&type=13F-HR&dateb=&owner=include&count=10`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                    <div className="edgar-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#000', borderBottom: '1px solid #000', paddingBottom: '2px', cursor: 'pointer' }}>
                      SEC EDGAR에서 직접 보기 ↗
                    </div>
                  </a>
                </div>
              ) : current.holdings.length === 0 ? (
                <p style={{ fontSize: '14px', color: '#aaa' }}>보유 종목 데이터가 없습니다.</p>
              ) : (
                <>
                  {/* 요약 카드 */}
                  <div style={{ display: 'flex', gap: '32px', marginBottom: '40px', padding: '20px 24px', border: '1px solid #e8e8e8', borderRadius: '4px' }}>
                    <div>
                      <p style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: '6px' }}>보유 종목 수</p>
                      <p style={{ fontSize: '24px', fontWeight: '400' }}>{current.holdings.length}<span style={{ fontSize: '13px', color: '#aaa', marginLeft: '4px' }}>개 (Top 30)</span></p>
                    </div>
                    <div style={{ borderLeft: '1px solid #e8e8e8', paddingLeft: '32px' }}>
                      <p style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: '6px' }}>총 포트폴리오 가치</p>
                      <p style={{ fontSize: '24px', fontWeight: '400' }}>{formatValue(current.holdings.reduce((s, h) => s + h.value, 0))}</p>
                    </div>
                  </div>

                  {/* 도넛 차트 */}
                  <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '16px' }}>Top 10 Holdings</p>
                  <DonutChart holdings={current.holdings} />

                  {/* 테이블 */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e8e8e8' }}>
                        {['#', '종목명', '비중', '보유 주수', '시장가치', '전분기 대비'].map((h, i) => (
                          <th key={i} style={{ textAlign: i <= 1 ? 'left' : 'right', padding: '10px 0', fontWeight: '400', color: '#aaa', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', ...(i === 0 ? { width: '32px' } : {}) }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {current.holdings.map((h, i) => (
                        <tr key={i} className="table-row" style={{ borderBottom: '1px solid #f4f4f4' }}>
                          <td style={{ padding: '12px 0', color: '#bbb', fontSize: '12px' }}>{i + 1}</td>
                          <td style={{ padding: '12px 0', color: '#000' }}>{h.name}</td>
                          <td style={{ padding: '12px 0', textAlign: 'right', color: '#555' }}>{h.pct}%</td>
                          <td style={{ padding: '12px 0', textAlign: 'right', color: '#555', fontVariantNumeric: 'tabular-nums' }}>{formatShares(h.shares)}</td>
                          <td style={{ padding: '12px 0', textAlign: 'right', color: '#000', fontVariantNumeric: 'tabular-nums' }}>{formatValue(h.value)}</td>
                          <td style={{ padding: '12px 0', textAlign: 'right' }}><ChangeTag curr={h.shares} prev={h.prevShares} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ marginTop: '32px' }}>
                    <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${manager.cik}&type=13F-HR&dateb=&owner=include&count=10`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      <div className="edgar-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#000', borderBottom: '1px solid #000', paddingBottom: '2px', cursor: 'pointer' }}>
                        SEC EDGAR 원본 공시 보기 ↗
                      </div>
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <footer style={{ borderTop: '1px solid #e8e8e8', padding: '32px 48px', fontSize: '12px', color: '#aaa' }}>
          <span>Anthracite © 2026</span>
        </footer>
      </div>
    </>
  )
}