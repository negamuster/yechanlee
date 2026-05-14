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

interface Holding {
  name: string
  shares: number
  value: number
  prevShares?: number
}

interface FilingData {
  period: string
  holdings: Holding[]
  loading: boolean
  error: string | null
}

function formatValue(v: number): string {
  if (v >= 1_000_000_000) return '$' + (v / 1_000_000_000).toFixed(2) + 'B'
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return '$' + (v / 1_000).toFixed(0) + 'K'
  return '$' + v.toLocaleString()
}

function formatShares(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return n.toLocaleString()
}

function ChangeTag({ curr, prev }: { curr: number; prev?: number }) {
  if (!prev || prev === 0) return <span style={{ fontSize: '11px', color: '#aaa', padding: '2px 8px', border: '1px solid #e8e8e8', borderRadius: '2px' }}>NEW</span>
  const pct = ((curr - prev) / prev) * 100
  const up = pct > 0
  const color = up ? '#16a34a' : '#ff3b30'
  const bg = up ? 'rgba(22,163,74,0.06)' : 'rgba(255,59,48,0.06)'
  const border = up ? 'rgba(22,163,74,0.2)' : 'rgba(255,59,48,0.2)'
  return (
    <span style={{ fontSize: '11px', color, padding: '2px 8px', border: `1px solid ${border}`, borderRadius: '2px', background: bg }}>
      {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

async function fetchLatest13F(cik: string): Promise<FilingData> {
  try {
    const subRes = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: { 'User-Agent': 'Anthracite anthracite@email.com' }
    })
    if (!subRes.ok) throw new Error('Failed to fetch submissions')
    const subData = await subRes.json()

    const filings = subData.filings?.recent
    if (!filings) throw new Error('No filings found')

    const forms: string[] = filings.form || []
    const dates: string[] = filings.reportDate || filings.filingDate || []
    const accNums: string[] = filings.accessionNumber || []
    const primaryDocs: string[] = filings.primaryDocument || []

    // 최신 13F-HR 찾기
    const idx13f = forms.findIndex((f: string) => f === '13F-HR')
    if (idx13f === -1) throw new Error('No 13F-HR found')
    const idx13fPrev = forms.findIndex((f: string, i: number) => f === '13F-HR' && i > idx13f)

    const accNum = accNums[idx13f].replace(/-/g, '')
    const period = dates[idx13f] || ''
    const primaryDoc = primaryDocs[idx13f]

    // infotable XML 파싱
    const baseUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accNum}`
    const idxRes = await fetch(`${baseUrl}/${primaryDoc}`, {
      headers: { 'User-Agent': 'Anthracite anthracite@email.com' }
    })
    if (!idxRes.ok) throw new Error('Failed to fetch filing index')
    const idxText = await idxRes.text()

    // XML에서 infotable 찾기
    const xmlMatch = idxText.match(/href="([^"]*infotable[^"]*\.xml[^"]*)"/i)
    let xmlUrl = ''
    if (xmlMatch) {
      xmlUrl = xmlMatch[1].startsWith('http') ? xmlMatch[1] : `https://www.sec.gov${xmlMatch[1]}`
    } else {
      // 대체: primary doc이 xml인 경우
      xmlUrl = `${baseUrl}/${primaryDoc}`
    }

    const xmlRes = await fetch(xmlUrl, {
      headers: { 'User-Agent': 'Anthracite anthracite@email.com' }
    })
    if (!xmlRes.ok) throw new Error('Failed to fetch XML')
    const xmlText = await xmlRes.text()

    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, 'application/xml')

    // infoTable 파싱
    const entries = doc.querySelectorAll('infoTable')
    const holdingMap: Map<string, Holding> = new Map()

    entries.forEach(entry => {
      const name = entry.querySelector('nameOfIssuer')?.textContent?.trim() || ''
      const sharesEl = entry.querySelector('sshPrnamt') || entry.querySelector('shrQty')
      const valueEl = entry.querySelector('value')
      const shares = parseInt(sharesEl?.textContent || '0')
      const value = parseInt(valueEl?.textContent || '0') * 1000

      if (holdingMap.has(name)) {
        const existing = holdingMap.get(name)!
        holdingMap.set(name, {
          name,
          shares: existing.shares + shares,
          value: existing.value + value,
        })
      } else {
        holdingMap.set(name, { name, shares, value })
      }
    })

    // 이전 분기 데이터 (가능하면)
    let prevMap: Map<string, number> = new Map()
    if (idx13fPrev !== -1) {
      try {
        const prevAccNum = accNums[idx13fPrev].replace(/-/g, '')
        const prevDoc = primaryDocs[idx13fPrev]
        const prevBase = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${prevAccNum}`
        const prevIdxRes = await fetch(`${prevBase}/${prevDoc}`, { headers: { 'User-Agent': 'Anthracite anthracite@email.com' } })
        const prevIdxText = await prevIdxRes.text()
        const prevXmlMatch = prevIdxText.match(/href="([^"]*infotable[^"]*\.xml[^"]*)"/i)
        let prevXmlUrl = ''
        if (prevXmlMatch) {
          prevXmlUrl = prevXmlMatch[1].startsWith('http') ? prevXmlMatch[1] : `https://www.sec.gov${prevXmlMatch[1]}`
        } else {
          prevXmlUrl = `${prevBase}/${prevDoc}`
        }
        const prevXmlRes = await fetch(prevXmlUrl, { headers: { 'User-Agent': 'Anthracite anthracite@email.com' } })
        const prevXmlText = await prevXmlRes.text()
        const prevDoc2 = parser.parseFromString(prevXmlText, 'application/xml')
        const prevEntries = prevDoc2.querySelectorAll('infoTable')
        prevEntries.forEach(entry => {
          const name = entry.querySelector('nameOfIssuer')?.textContent?.trim() || ''
          const sharesEl = entry.querySelector('sshPrnamt') || entry.querySelector('shrQty')
          const shares = parseInt(sharesEl?.textContent || '0')
          prevMap.set(name, (prevMap.get(name) || 0) + shares)
        })
      } catch {}
    }

    const holdings: Holding[] = Array.from(holdingMap.values())
      .map(h => ({ ...h, prevShares: prevMap.get(h.name) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 30)

    return { period, holdings, loading: false, error: null }
  } catch (e: any) {
    return { period: '', holdings: [], loading: false, error: e.message || 'Failed to load' }
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
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .page-title { opacity: 0; animation: slideUp 0.7s ease forwards 0.1s; }
        .page-desc  { opacity: 0; animation: slideUp 0.7s ease forwards 0.3s; }
        .page-section { opacity: 0; animation: slideUp 0.7s ease forwards 0.5s; }
        .mgr-btn { transition: all 0.15s ease; }
        .mgr-btn:hover { background: #f5f5f5; }
        .table-row:hover { background: #fafafa; }
      `}</style>

      <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: '"Times New Roman", Times, serif', color: '#000' }}>

        <nav style={{ padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8e8e8' }}>
          <span onClick={() => navigate('/')} style={{ fontSize: '22px', fontWeight: '600', cursor: 'pointer' }}>Anthracite</span>
        </nav>

        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '80px 48px 120px' }}>

          {/* HEADER */}
          <h1 className="page-title" style={{ fontSize: '52px', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '16px', lineHeight: '1.1' }}>
            Form 13F
          </h1>
          <p className="page-desc" style={{ fontSize: '18px', lineHeight: '1.85', color: '#444', maxWidth: '680px', marginBottom: '32px', textAlign: 'justify', wordBreak: 'keep-all' }}>
            미국에서 운용자산(AUM)이 일정 규모 이상인 기관투자자는 분기마다 보유 주식을 SEC에 공개해야 합니다. 그 보고서가 Form 13F입니다.
          </p>

          {/* 주의사항 */}
          <div className="page-desc" style={{ padding: '20px 24px', border: '1px solid #e8e8e8', borderRadius: '4px', marginBottom: '64px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '4px' }}>주의사항</p>
            {[
              '최대 45일 지연 — 공시 시점과 실제 보유 시점에 차이가 있습니다.',
              '미국 상장 주식 중심 — 현금, 채권, 공매도(Short), 비상장 투자, 해외 주식 상당수는 포함되지 않습니다.',
              '복사 매매 주의 — 공시 데이터만으로 투자 결정을 내리는 것은 위험할 수 있습니다.',
            ].map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '13px', color: '#bbb', flexShrink: 0, marginTop: '2px' }}>—</span>
                <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>{text}</p>
              </div>
            ))}
          </div>

          <div className="page-section" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '48px', alignItems: 'start' }}>

            {/* 왼쪽: 매니저 목록 */}
            <div style={{ borderRight: '1px solid #e8e8e8', paddingRight: '32px' }}>
              <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '20px' }}>Investors</p>
              {MANAGERS.map((m, i) => (
                <div
                  key={i}
                  className="mgr-btn"
                  onClick={() => setSelectedIdx(i)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginBottom: '4px',
                    background: selectedIdx === i ? '#f5f5f5' : 'transparent',
                    borderLeft: selectedIdx === i ? '2px solid #000' : '2px solid transparent',
                  }}
                >
                  <p style={{ fontSize: '14px', fontWeight: selectedIdx === i ? '500' : '400', color: '#000', marginBottom: '2px' }}>{m.name}</p>
                  <p style={{ fontSize: '11px', color: '#aaa' }}>{m.firm}</p>
                </div>
              ))}
            </div>

            {/* 오른쪽: 데이터 */}
            <div>
              {/* 헤더 */}
              <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: '400', marginBottom: '6px' }}>{manager.name}</h2>
                <p style={{ fontSize: '14px', color: '#aaa' }}>{manager.firm}</p>
                {current?.period && (
                  <p style={{ fontSize: '13px', color: '#aaa', marginTop: '6px' }}>
                    최신 공시 기준: {current.period}
                  </p>
                )}
              </div>

              {/* 상태 */}
              {!current || current.loading ? (
                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', color: '#aaa' }}>데이터를 불러오는 중...</p>
                </div>
              ) : current.error ? (
                <div style={{ padding: '32px', border: '1px solid #e8e8e8', borderRadius: '4px' }}>
                  <p style={{ fontSize: '14px', color: '#aaa', marginBottom: '12px' }}>데이터를 불러오지 못했습니다.</p>
                  <a
                    href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${manager.cik}&type=13F-HR&dateb=&owner=include&count=10`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <div
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#000', borderBottom: '1px solid #000', paddingBottom: '2px', cursor: 'pointer' }}
                    >
                      SEC EDGAR에서 직접 보기 ↗
                    </div>
                  </a>
                </div>
              ) : current.holdings.length === 0 ? (
                <p style={{ fontSize: '14px', color: '#aaa' }}>보유 종목 데이터가 없습니다.</p>
              ) : (
                <>
                  {/* 요약 */}
                  <div style={{ display: 'flex', gap: '32px', marginBottom: '32px', padding: '20px 24px', border: '1px solid #e8e8e8', borderRadius: '4px' }}>
                    <div>
                      <p style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: '6px' }}>보유 종목 수</p>
                      <p style={{ fontSize: '24px', fontWeight: '400' }}>{current.holdings.length}<span style={{ fontSize: '13px', color: '#aaa', marginLeft: '4px' }}>개 (Top 30)</span></p>
                    </div>
                    <div style={{ borderLeft: '1px solid #e8e8e8', paddingLeft: '32px' }}>
                      <p style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#aaa', marginBottom: '6px' }}>총 포트폴리오 가치</p>
                      <p style={{ fontSize: '24px', fontWeight: '400' }}>{formatValue(current.holdings.reduce((s, h) => s + h.value, 0))}</p>
                    </div>
                  </div>

                  {/* 테이블 */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e8e8e8' }}>
                        <th style={{ textAlign: 'left', padding: '10px 0', fontWeight: '400', color: '#aaa', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', width: '32px' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '10px 0', fontWeight: '400', color: '#aaa', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>종목명</th>
                        <th style={{ textAlign: 'right', padding: '10px 0', fontWeight: '400', color: '#aaa', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>보유 주수</th>
                        <th style={{ textAlign: 'right', padding: '10px 0', fontWeight: '400', color: '#aaa', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>시장가치</th>
                        <th style={{ textAlign: 'right', padding: '10px 0', fontWeight: '400', color: '#aaa', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>전분기 대비</th>
                      </tr>
                    </thead>
                    <tbody>
                      {current.holdings.map((h, i) => (
                        <tr key={i} className="table-row" style={{ borderBottom: '1px solid #f4f4f4' }}>
                          <td style={{ padding: '12px 0', color: '#bbb', fontSize: '12px' }}>{i + 1}</td>
                          <td style={{ padding: '12px 0', color: '#000', fontWeight: '400' }}>{h.name}</td>
                          <td style={{ padding: '12px 0', textAlign: 'right', color: '#555', fontVariantNumeric: 'tabular-nums' }}>{formatShares(h.shares)}</td>
                          <td style={{ padding: '12px 0', textAlign: 'right', color: '#000', fontVariantNumeric: 'tabular-nums', fontWeight: '400' }}>{formatValue(h.value)}</td>
                          <td style={{ padding: '12px 0', textAlign: 'right' }}>
                            <ChangeTag curr={h.shares} prev={h.prevShares} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* EDGAR 링크 */}
                  <div style={{ marginTop: '32px' }}>
                    <a
                      href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${manager.cik}&type=13F-HR&dateb=&owner=include&count=10`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: 'none' }}
                    >
                      <div
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#000', borderBottom: '1px solid #000', paddingBottom: '2px', cursor: 'pointer', transition: 'opacity 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.4')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                      >
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