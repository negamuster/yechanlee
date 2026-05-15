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

const proxy = (url: string) => `/api/sec-proxy?url=${encodeURIComponent(url)}`

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
      {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

// XML 텍스트에서 infoTable 파싱
function parseInfoTable(xmlText: string): Map<string, Holding> {
  const map = new Map<string, Holding>()
  // namespace 제거 후 파싱
  const cleaned = xmlText.replace(/<[a-zA-Z]+:/g, '<').replace(/<\/[a-zA-Z]+:/g, '</')
  const parser = new DOMParser()
  const doc = parser.parseFromString(cleaned, 'application/xml')

  let entries = doc.querySelectorAll('infoTable')
  if (entries.length === 0) {
    // 대소문자 다른 경우
    entries = doc.querySelectorAll('InfoTable, INFOTABLE')
  }

  entries.forEach(entry => {
    const name = (
      entry.querySelector('nameOfIssuer')?.textContent ||
      entry.querySelector('NAMEOFISSUER')?.textContent ||
      ''
    ).trim()

    const sharesEl =
      entry.querySelector('sshPrnamt') ||
      entry.querySelector('SSHPRNAMT') ||
      entry.querySelector('shrQty') ||
      entry.querySelector('SHRQTY')
    const shares = parseInt(sharesEl?.textContent || '0') || 0

    const valueEl =
      entry.querySelector('value') ||
      entry.querySelector('VALUE')
    const value = (parseInt(valueEl?.textContent || '0') || 0) * 1000

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

// 제출 목록에서 13F XML URL 찾기
async function findXmlUrl(cikInt: number, accNum: string, primaryDoc: string): Promise<string> {
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accNum}`

  // 1. filing-index 페이지에서 XML 찾기
  try {
    const idxRes = await fetch(proxy(`${baseUrl}/${primaryDoc}`))
    const idxText = await idxRes.text()

    // infotable xml
    const m1 = idxText.match(/href="([^"]*infotable[^"]*\.xml)"/i)
    if (m1) return m1[1].startsWith('http') ? m1[1] : `https://www.sec.gov${m1[1]}`

    // 아무 xml
    const m2 = idxText.match(/href="([^"]*\.xml)"/i)
    if (m2) return m2[1].startsWith('http') ? m2[1] : `https://www.sec.gov${m2[1]}`
  } catch {}

  // 2. -index.htm 시도
  try {
    const indexHtm = `${baseUrl}/${accNum}-index.htm`
    const idxRes = await fetch(proxy(indexHtm))
    const idxText = await idxRes.text()
    const m = idxText.match(/href="([^"]*\.xml)"/i)
    if (m) return m[1].startsWith('http') ? m[1] : `https://www.sec.gov${m[1]}`
  } catch {}

  // 3. form13fInfoTable.xml 직접 시도
  return `${baseUrl}/form13fInfoTable.xml`
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

    // 최신 XML
    const xmlUrl = await findXmlUrl(cikInt, accNum, primaryDocs[idx])
    const xmlRes = await fetch(proxy(xmlUrl))
    if (!xmlRes.ok) throw new Error(`xml fetch failed: ${xmlUrl}`)
    const xmlText = await xmlRes.text()

    const holdingMap = parseInfoTable(xmlText)
    if (holdingMap.size === 0) throw new Error('no holdings parsed from XML')

    // 이전 분기
    const prevMap = new Map<string, number>()
    if (idxPrev !== undefined) {
      try {
        const prevAccNum = accNums[idxPrev].replace(/-/g, '')
        const prevXmlUrl = await findXmlUrl(cikInt, prevAccNum, primaryDocs[idxPrev])
        const prevXmlRes = await fetch(proxy(prevXmlUrl))
        const prevXmlText = await prevXmlRes.text()
        const pm = parseInfoTable(prevXmlText)
        pm.forEach((h, name) => prevMap.set(name, h.shares))
      } catch {}
    }

    const holdings: Holding[] = Array.from(holdingMap.values())
      .map(h => ({ ...h, prevShares: prevMap.get(h.name) }))
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
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
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

          <h1 className="page-title" style={{ fontSize: '52px', fontWeight: '400', letterSpacing: '-0.02em', marginBottom: '20px', lineHeight: '1.1' }}>
            Form 13F
          </h1>
          <p className="page-desc" style={{ fontSize: '18px', lineHeight: '1.85', color: '#444', maxWidth: '720px', marginBottom: '32px', textAlign: 'justify', wordBreak: 'keep-all' }}>
            미국에서 일정 규모 이상의 자산(AUM)을 운용하는 기관투자자는 분기마다 보유 주식을 미국 증권거래위원회(SEC)에 공개해야 하며, 이를 Form 13F라고 합니다. 이를 통해 주요 기관투자자들의 최신 포트폴리오와 보유 종목 변화를 확인할 수 있으며, 투자 비중과 신규 매수·매도 내역을 통해 기관 자금의 흐름과 시장에 대한 시각을 살펴볼 수 있습니다.
          </p>

          <div className="page-desc" style={{ padding: '20px 24px', border: '1px solid #e8e8e8', borderRadius: '4px', marginBottom: '64px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '4px' }}>주의사항</p>
            {[
              '최대 45일 지연 - 공시 시점과 실제 보유 시점에 차이가 있습니다.',
              '미국 상장 주식 중심 - 현금, 채권, 공매도(Short), 비상장 투자, 해외 주식 상당수는 포함되지 않습니다.',
              '복사 매매 주의 - 공시 데이터만으로 투자 결정을 내리는 것은 위험할 수 있습니다.',
            ].map((text, i) => (
              <p key={i} style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>{text}</p>
            ))}
          </div>

          <div className="page-section" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '48px', alignItems: 'start' }}>

            <div style={{ borderRight: '1px solid #e8e8e8', paddingRight: '40px' }}>
              <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: '20px' }}>Investors</p>
              {MANAGERS.map((m, i) => (
                <div
                  key={i}
                  className="mgr-btn"
                  onClick={() => setSelectedIdx(i)}
                  style={{
                    padding: '16px 18px',
                    borderRadius: '4px',
                    marginBottom: '4px',
                    background: selectedIdx === i ? '#f5f5f5' : 'transparent',
                    borderLeft: selectedIdx === i ? '2px solid #000' : '2px solid transparent',
                  }}
                >
                  <p style={{ fontSize: '15px', fontWeight: selectedIdx === i ? '500' : '400', color: '#000', marginBottom: '3px' }}>{m.name}</p>
                  <p style={{ fontSize: '12px', color: '#aaa' }}>{m.firm}</p>
                </div>
              ))}
            </div>

            <div>
              <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: '400', marginBottom: '6px' }}>{manager.name}</h2>
                <p style={{ fontSize: '14px', color: '#aaa' }}>{manager.firm}</p>
                {current?.period && (
                  <p style={{ fontSize: '13px', color: '#aaa', marginTop: '6px' }}>최신 공시 기준: {current.period}</p>
                )}
              </div>

              {!current || current.loading ? (
                <div style={{ padding: '64px 0', textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', color: '#aaa' }}>SEC EDGAR에서 데이터를 불러오는 중...</p>
                </div>
              ) : current.error ? (
                <div style={{ padding: '32px', border: '1px solid #e8e8e8', borderRadius: '4px' }}>
                  <p style={{ fontSize: '14px', color: '#aaa', marginBottom: '16px' }}>데이터를 불러오지 못했습니다.</p>
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
                          <td style={{ padding: '12px 0', color: '#000' }}>{h.name}</td>
                          <td style={{ padding: '12px 0', textAlign: 'right', color: '#555', fontVariantNumeric: 'tabular-nums' }}>{formatShares(h.shares)}</td>
                          <td style={{ padding: '12px 0', textAlign: 'right', color: '#000', fontVariantNumeric: 'tabular-nums' }}>{formatValue(h.value)}</td>
                          <td style={{ padding: '12px 0', textAlign: 'right' }}>
                            <ChangeTag curr={h.shares} prev={h.prevShares} />
                          </td>
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