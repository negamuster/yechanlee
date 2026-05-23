import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface Manager {
  name: string
  nameKo: string
  firm: string
  cik: string
  totalValue?: number
}

const INITIAL_MANAGERS: Manager[] = [
  { name: 'Warren Buffett', nameKo: '워렌 버핏', firm: 'Berkshire Hathaway', cik: '0001067983' },
  { name: 'BlackRock', nameKo: '블랙록', firm: 'BlackRock Inc.', cik: '0001364742' },
  { name: 'Vanguard Group', nameKo: '뱅가드', firm: 'The Vanguard Group', cik: '0000102909' },
  { name: 'State Street', nameKo: '스테이트 스트리트', firm: 'State Street Corporation', cik: '0000093751' },
  { name: 'Ray Dalio', nameKo: '레이 달리오', firm: 'Bridgewater Associates', cik: '0001350694' },
  { name: 'Ken Griffin', nameKo: '켄 그리핀', firm: 'Citadel Advisors', cik: '0001423298' },
  { name: 'Jim Simons', nameKo: '짐 사이먼스', firm: 'Renaissance Technologies', cik: '0001037389' },
  { name: 'Stanley Druckenmiller', nameKo: '스탠리 드러켄밀러', firm: 'Duquesne Family Office', cik: '0001536411' },
  { name: 'Bill Ackman', nameKo: '빌 애크먼', firm: 'Pershing Square', cik: '0001336528' },
  { name: 'David Tepper', nameKo: '데이비드 테퍼', firm: 'Appaloosa Management', cik: '0001418736' },
  { name: 'George Soros', nameKo: '조지 소로스', firm: 'Soros Fund Management', cik: '0001029160' },
  { name: 'Cathie Wood', nameKo: '캐시 우드', firm: 'ARK Invest', cik: '0001697748' },
  { name: 'Li Lu', nameKo: '리 루', firm: 'Himalaya Capital', cik: '0001709323' },
  { name: 'Michael Burry', nameKo: '마이클 버리', firm: 'Scion Asset Management', cik: '0001649339' },
]

const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#F97316','#84CC16','#6366F1']

const NAME_TO_TICKER: Record<string, string> = {
  'APPLE INC': 'AAPL', 'MICROSOFT CORP': 'MSFT', 'NVIDIA CORPORATION': 'NVDA',
  'NVIDIA CORP': 'NVDA', 'AMAZON COM INC': 'AMZN', 'ALPHABET INC': 'GOOGL',
  'META PLATFORMS INC': 'META', 'TESLA INC': 'TSLA', 'BERKSHIRE HATHAWAY INC': 'BRK.B',
  'BROADCOM INC': 'AVGO', 'ELI LILLY & CO': 'LLY', 'JPMORGAN CHASE & CO': 'JPM',
  'VISA INC': 'V', 'EXXON MOBIL CORP': 'XOM', 'UNITEDHEALTH GROUP INC': 'UNH',
  'JOHNSON & JOHNSON': 'JNJ', 'WALMART INC': 'WMT', 'MASTERCARD INC': 'MA',
  'PROCTER & GAMBLE CO': 'PG', 'HOME DEPOT INC': 'HD', 'BANK OF AMERICA CORP': 'BAC',
  'CHEVRON CORP': 'CVX', 'MERCK & CO INC': 'MRK', 'ABBVIE INC': 'ABBV',
  'COSTCO WHOLESALE CORP': 'COST', 'PEPSICO INC': 'PEP', 'COCA COLA CO': 'KO',
  'COCA-COLA CO': 'KO', 'NETFLIX INC': 'NFLX', 'SALESFORCE INC': 'CRM',
  'ADOBE INC': 'ADBE', 'ADVANCED MICRO DEVICES INC': 'AMD', 'QUALCOMM INC': 'QCOM',
  'INTEL CORP': 'INTC', 'AMERICAN EXPRESS CO': 'AXP', 'WELLS FARGO & CO': 'WFC',
  'MORGAN STANLEY': 'MS', 'GOLDMAN SACHS GROUP INC': 'GS', 'CITIGROUP INC': 'C',
  'T MOBILE US INC': 'TMUS', 'VERIZON COMMUNICATIONS INC': 'VZ', 'BOEING CO': 'BA',
  'CATERPILLAR INC': 'CAT', 'PALANTIR TECHNOLOGIES INC': 'PLTR',
  'COINBASE GLOBAL INC': 'COIN', 'ROKU INC': 'ROKU', 'BLOCK INC': 'SQ',
  'MOLINA HEALTHCARE INC': 'MOH', 'LULULEMON ATHLETICA INC': 'LULU',
  'ALIBABA GROUP HOLDING LTD': 'BABA', 'BAIDU INC': 'BIDU',
  'PFIZER INC': 'PFE', 'HALLIBURTON CO': 'HAL', 'SLM CORP': 'SLM',
  'BLACKROCK INC': 'BLK', 'SPDR S&P 500 ETF TRUST': 'SPY',
  'ISHARES CORE S&P 500 ETF': 'IVV', 'VANGUARD S&P 500 ETF': 'VOO',
  'NATERA INC': 'NTRA', 'AMERICAN AIRLINES GROUP INC': 'AAL',
  'DELTA AIR LINES INC': 'DAL', 'UNITED AIRLINES HOLDINGS INC': 'UAL',
}

function getTickerForLogo(name: string): string | null {
  const upper = name.toUpperCase().trim()
  for (const [key, ticker] of Object.entries(NAME_TO_TICKER)) {
    if (upper === key || upper.startsWith(key)) return ticker
  }
  return null
}

function formatName(name: string): string {
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

function StockLogo({ name }: { name: string }) {
  const ticker = getTickerForLogo(name)
  const [err, setErr] = useState(false)
  if (!ticker || err) {
    const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    return (
      <div style={{ width:'36px', height:'36px', borderRadius:'8px', background:'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <span style={{ fontSize:'11px', fontWeight:'600', color:'#888', fontFamily:'system-ui' }}>{initials}</span>
      </div>
    )
  }
  return (
    <img
      src={`https://logo.clearbit.com/${ticker.toLowerCase().replace(/\./g,'')}.com`}
      alt={name}
      onError={() => setErr(true)}
      style={{ width:'36px', height:'36px', borderRadius:'8px', objectFit:'contain', border:'1px solid #f0f0f0', flexShrink:0 }}
    />
  )
}

interface Holding {
  name: string; shares: number; value: number; prevShares?: number; pct?: number
}
interface FilingData {
  period: string; holdings: Holding[]; loading: boolean; error: string | null; totalValue: number
}

const proxy = (url: string) => `/api/sec-proxy?url=${encodeURIComponent(url)}`

function formatValue(v: number): string {
  if (v >= 1_000_000_000_000) return '$' + (v / 1_000_000_000_000).toFixed(1) + 'T'
  if (v >= 1_000_000_000) return '$' + (v / 1_000_000_000).toFixed(1) + 'B'
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return '$' + Math.round(v / 1_000).toLocaleString() + 'K'
  return '$' + Math.round(v).toLocaleString()
}

function formatShares(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return Math.round(n / 1_000).toLocaleString() + 'K'
  return Math.round(n).toLocaleString()
}

function LastTransactionTag({ curr, prev }: { curr: number; prev?: number }) {
  if (prev === undefined || prev === 0) return <span style={{ fontSize:'12px', color:'#16a34a' }}>New holding</span>
  if (curr === 0) return <span style={{ fontSize:'12px', color:'#ff3b30' }}>Sold out</span>
  const pct = Math.round(((curr - prev) / prev) * 100)
  if (pct > 0) return <span style={{ fontSize:'12px', color:'#16a34a' }}>+{pct}%</span>
  if (pct < 0) return <span style={{ fontSize:'12px', color:'#ff3b30' }}>{pct}%</span>
  return <span style={{ fontSize:'12px', color:'#aaa' }}>Unchanged</span>
}

function DonutChart({ holdings }: { holdings: Holding[] }) {
  const top10 = holdings.slice(0, 10)
  const total = holdings.reduce((s, h) => s + h.value, 0)
  const R = 80, r = 52, cx = 100, cy = 100
  let angle = -Math.PI / 2
  const slices = top10.map((h, i) => {
    const pct = h.value / total
    const start = angle; angle += pct * 2 * Math.PI; const end = angle
    const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start)
    const x2 = cx + R * Math.cos(end), y2 = cy + R * Math.sin(end)
    const ix1 = cx + r * Math.cos(end), iy1 = cy + r * Math.sin(end)
    const ix2 = cx + r * Math.cos(start), iy2 = cy + r * Math.sin(start)
    const large = pct > 0.5 ? 1 : 0
    const d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${r} ${r} 0 ${large} 0 ${ix2} ${iy2} Z`
    return { d, color: COLORS[i], name: h.name, pct: Math.round(h.value / total * 1000) / 10 }
  })
  const othersStart = angle
  const othersPct = 1 - top10.reduce((s, h) => s + h.value / total, 0)
  return (
    <div style={{ display:'flex', gap:'40px', alignItems:'center', marginBottom:'40px' }}>
      <div style={{ flexShrink:0 }}>
        <svg viewBox="0 0 200 200" style={{ width:'180px' }}>
          {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} stroke="#fff" strokeWidth="2" />)}
          {othersPct > 0.005 && (() => {
            const end2 = othersStart + othersPct * 2 * Math.PI
            const x1 = cx + R * Math.cos(othersStart), y1 = cy + R * Math.sin(othersStart)
            const x2 = cx + R * Math.cos(end2), y2 = cy + R * Math.sin(end2)
            const ix1 = cx + r * Math.cos(end2), iy1 = cy + r * Math.sin(end2)
            const ix2 = cx + r * Math.cos(othersStart), iy2 = cy + r * Math.sin(othersStart)
            const large = othersPct > 0.5 ? 1 : 0
            return <path d={`M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${r} ${r} 0 ${large} 0 ${ix2} ${iy2} Z`} fill="#e8e8e8" stroke="#fff" strokeWidth="2" />
          })()}
          <text x="100" y="94" textAnchor="middle" fontSize="13" fill="#000" fontFamily='"Times New Roman",serif' fontWeight="500">{formatValue(total)}</text>
          <text x="100" y="112" textAnchor="middle" fontSize="10" fill="#aaa" fontFamily="system-ui">Total value</text>
        </svg>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'8px', flex:1 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ width:'10px', height:'10px', borderRadius:'2px', background:s.color, flexShrink:0 }} />
            <span style={{ fontSize:'12px', color:'#333', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{formatName(s.name)}</span>
            <span style={{ fontSize:'12px', color:'#aaa', minWidth:'36px', textAlign:'right' }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function parseInfoTable(xmlText: string): Map<string, Holding> {
  const map = new Map<string, Holding>()
  const cleaned = xmlText.replace(/<[a-zA-Z][a-zA-Z0-9]*:/g, '<').replace(/<\/[a-zA-Z][a-zA-Z0-9]*:/g, '</')
  const parser = new DOMParser()
  const doc = parser.parseFromString(cleaned, 'application/xml')
  let entries = doc.querySelectorAll('infoTable')
  if (entries.length === 0) entries = doc.querySelectorAll('InfoTable')
  entries.forEach(entry => {
    const name = (entry.querySelector('nameOfIssuer, NAMEOFISSUER')?.textContent || '').trim()
    const shares = parseInt(entry.querySelector('sshPrnamt, SSHPRNAMT, shrQty, SHRQTY')?.textContent || '0') || 0
    const value = parseInt(entry.querySelector('value, VALUE')?.textContent || '0') || 0
    const putCall = entry.querySelector('putCall, PUTCALL')?.textContent?.trim() || ''
    if (putCall === 'Put' || putCall === 'Call') return
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

async function fetchFiling(cikInt: number, accNum: string, primaryDoc: string): Promise<Map<string, Holding>> {
  const base = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accNum}`
  const accNumDashed = accNum.replace(/(\d{10})(\d{2})(\d{6})/, '$1-$2-$3')
  const resolveUrl = (href: string): string => {
    if (href.startsWith('http')) return href
    if (href.startsWith('/')) return `https://www.sec.gov${href}`
    return `${base}/${href}`
  }
  try {
    const idxRes = await fetch(proxy(`${base}/${accNumDashed}-index.htm`))
    if (idxRes.ok) {
      const idxText = await idxRes.text()
      const links = [...idxText.matchAll(/href="([^"]*\.xml)"/gi)]
        .map(m => resolveUrl(m[1])).filter(u => !u.includes('primary_doc'))
      for (const xmlUrl of links) {
        try {
          const r = await fetch(proxy(xmlUrl))
          if (r.ok) { const m = parseInfoTable(await r.text()); if (m.size > 0) return m }
        } catch {}
      }
    }
  } catch {}
  try {
    const res = await fetch(proxy(`${base}/${primaryDoc}`))
    if (res.ok) {
      const text = await res.text()
      const links = [...text.matchAll(/href="([^"]*\.xml)"/gi)]
        .map(m => resolveUrl(m[1])).filter(u => !u.includes('primary_doc'))
      for (const xmlUrl of links) {
        try {
          const r = await fetch(proxy(xmlUrl))
          if (r.ok) { const m = parseInfoTable(await r.text()); if (m.size > 0) return m }
        } catch {}
      }
    }
  } catch {}
  for (const name of ['form13fInfoTable.xml', 'infotable.xml', 'information_table.xml']) {
    try {
      const r = await fetch(proxy(`${base}/${name}`))
      if (r.ok) { const m = parseInfoTable(await r.text()); if (m.size > 0) return m }
    } catch {}
  }
  throw new Error(`XML not found for accession ${accNum}`)
}

async function fetchLatest13F(cik: string): Promise<FilingData> {
  try {
    const subRes = await fetch(proxy(`https://data.sec.gov/submissions/CIK${cik}.json`))
    if (!subRes.ok) throw new Error('submissions fetch failed')
    const subData = await subRes.json()
    if (!subData.filings) throw new Error('no filings data')

    // recent에서 먼저 탐색
    let forms: string[] = subData.filings.recent?.form || []
    let dates: string[] = subData.filings.recent?.reportDate || subData.filings.recent?.filingDate || []
    let accNums: string[] = subData.filings.recent?.accessionNumber || []
    let primaryDocs: string[] = subData.filings.recent?.primaryDocument || []
    let indices13f = forms.reduce<number[]>((acc, f, i) => { if (f === '13F-HR') acc.push(i); return acc }, [])

    // recent에 없으면 files 배열(페이지네이션된 추가 제출 기록)도 탐색
    if (indices13f.length === 0) {
      const extraFiles: { name: string }[] = subData.filings.files || []
      for (const file of extraFiles) {
        try {
          const fileRes = await fetch(proxy(`https://data.sec.gov/submissions/${file.name}`))
          if (!fileRes.ok) continue
          const fileData = await fileRes.json()
          const moreForms: string[] = fileData.form || []
          const moreIdx = moreForms.reduce<number[]>((acc, f, i) => { if (f === '13F-HR') acc.push(i); return acc }, [])
          if (moreIdx.length > 0) {
            forms = moreForms
            dates = fileData.reportDate || fileData.filingDate || []
            accNums = fileData.accessionNumber || []
            primaryDocs = fileData.primaryDocument || []
            indices13f = moreIdx
            break
          }
        } catch {}
      }
    }

    if (indices13f.length === 0) throw new Error('no 13F-HR filings found')

    const idx = indices13f[0]
    const idxPrev = indices13f.length > 1 ? indices13f[1] : undefined
    const period = dates[idx] || ''
    const accNum = accNums[idx].replace(/-/g, '')
    const cikInt = parseInt(cik)
    const holdingMap = await fetchFiling(cikInt, accNum, primaryDocs[idx])
    const prevMap = new Map<string, number>()
    if (idxPrev !== undefined) {
      try {
        const prevAccNum = accNums[idxPrev].replace(/-/g, '')
        const pm = await fetchFiling(cikInt, prevAccNum, primaryDocs[idxPrev])
        pm.forEach((h, name) => prevMap.set(name, h.shares))
      } catch {}
    }
    const totalValue = Array.from(holdingMap.values()).reduce((s, h) => s + h.value, 0)
    const holdings: Holding[] = Array.from(holdingMap.values())
      .map(h => ({ ...h, prevShares: prevMap.get(h.name), pct: Math.round(h.value / totalValue * 1000) / 10 }))
      .sort((a, b) => b.value - a.value).slice(0, 30)
    return { period, holdings, loading: false, error: null, totalValue }
  } catch (e: any) {
    return { period: '', holdings: [], loading: false, error: e.message, totalValue: 0 }
  }
}

export default function Form13F() {
  const navigate = useNavigate()
  const [managers, setManagers] = useState<Manager[]>(INITIAL_MANAGERS)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [cache, setCache] = useState<Record<string, FilingData>>({})
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [loadingAll, setLoadingAll] = useState(true)

  const selectedManager = managers[selectedIdx]

  // 최초 진입 시 전체 기관 totalValue 로드 → 정렬 고정
  useEffect(() => {
    if (initialLoadDone) return
    setInitialLoadDone(true)

    const loadAll = async () => {
      const results = await Promise.allSettled(
        INITIAL_MANAGERS.map(m => fetchLatest13F(m.cik))
      )
      const newCache: Record<string, FilingData> = {}
      const updated = INITIAL_MANAGERS.map((m, i) => {
        const result = results[i]
        const data = result.status === 'fulfilled' ? result.value : { period:'', holdings:[], loading:false, error:'failed', totalValue:0 }
        newCache[m.cik] = data
        return { ...m, totalValue: data.totalValue }
      })
      const sorted = [...updated].sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))
      setCache(newCache)
      setManagers(sorted)
      setSelectedIdx(0)
      setLoadingAll(false)
    }

    loadAll()
  }, [])

  const current = cache[selectedManager?.cik]

  return (
    <>
      <style>{`
        @keyframes slideUp { from{opacity:0;transform:translateY(30px);}to{opacity:1;transform:translateY(0);} }
        @keyframes spin { from{transform:rotate(0deg);}to{transform:rotate(360deg);} }
        .page-title{opacity:0;animation:slideUp 0.7s ease forwards 0.1s;}
        .page-desc{opacity:0;animation:slideUp 0.7s ease forwards 0.3s;}
        .page-section{opacity:0;animation:slideUp 0.7s ease forwards 0.5s;}
        .mgr-btn{transition:all 0.15s ease;cursor:pointer;}
        .mgr-btn:hover{background:#f5f5f5 !important;}
        .table-row:hover{background:#fafafa;}
        .edgar-link{transition:opacity 0.15s;}
        .edgar-link:hover{opacity:0.4;}
      `}</style>

      <div style={{ backgroundColor:'#fff', minHeight:'100vh', fontFamily:'"Times New Roman",Times,serif', color:'#000' }}>
        <nav style={{ padding:'32px 48px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #e8e8e8' }}>
          <span onClick={() => navigate('/')} style={{ fontSize:'22px', fontWeight:'600', cursor:'pointer' }}>Anthracite</span>
        </nav>

        <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'80px 48px 120px' }}>
          <h1 className="page-title" style={{ fontSize:'52px', fontWeight:'400', letterSpacing:'-0.02em', marginBottom:'20px', lineHeight:'1.1' }}>Form 13F</h1>
          <p className="page-desc" style={{ fontSize:'18px', lineHeight:'1.85', color:'#444', maxWidth:'720px', marginBottom:'32px', textAlign:'justify', wordBreak:'keep-all' }}>
            미국에서 일정 규모 이상의 자산(AUM)을 운용하는 기관투자자는 분기마다 보유 주식을 미국 증권거래위원회(SEC)에 공개해야 하며, 이를 Form 13F라고 합니다. 이를 통해 주요 기관투자자들의 최신 포트폴리오와 보유 종목 변화를 확인할 수 있으며, 투자 비중과 신규 매수·매도 내역을 통해 기관 자금의 흐름과 시장에 대한 시각을 살펴볼 수 있습니다.
          </p>

          <div className="page-desc" style={{ padding:'20px 24px', border:'1px solid #e8e8e8', borderRadius:'4px', marginBottom:'64px', display:'flex', flexDirection:'column', gap:'10px' }}>
            <p style={{ fontSize:'11px', letterSpacing:'0.15em', textTransform:'uppercase', color:'#aaa', marginBottom:'4px' }}>주의사항</p>
            {['최대 45일 지연 - 공시 시점과 실제 보유 시점에 차이가 있습니다.',
              '미국 상장 주식 중심 - 현금, 채권, 공매도(Short), 비상장 투자, 해외 주식 상당수는 포함되지 않습니다.',
              '복사 매매 주의 - 공시 데이터만으로 투자 결정을 내리는 것은 위험할 수 있습니다.',
            ].map((t,i) => <p key={i} style={{ fontSize:'14px', color:'#666', lineHeight:'1.6' }}>{t}</p>)}
          </div>

          <div className="page-section" style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:'48px', alignItems:'start' }}>

            {/* 왼쪽 */}
            <div style={{ borderRight:'1px solid #e8e8e8', paddingRight:'40px' }}>
              <p style={{ fontSize:'11px', letterSpacing:'0.15em', textTransform:'uppercase', color:'#aaa', marginBottom:'20px' }}>Investors</p>

              {loadingAll ? (
                // 스켈레톤 + 스피너
                <>
                  <div style={{ display:'flex', justifyContent:'center', padding:'24px 0 20px' }}>
                    <div style={{
                      width:'24px', height:'24px', borderRadius:'50%',
                      border:'2px solid #e8e8e8', borderTopColor:'#000',
                      animation:'spin 0.8s linear infinite'
                    }} />
                  </div>
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div key={i} style={{ padding:'14px 16px', marginBottom:'4px' }}>
                      <div style={{ height:'14px', background:'#f0f0f0', borderRadius:'3px', marginBottom:'6px', width: i % 3 === 0 ? '80%' : i % 3 === 1 ? '65%' : '72%' }} />
                      <div style={{ height:'11px', background:'#f7f7f7', borderRadius:'3px', width:'50%' }} />
                    </div>
                  ))}
                </>
              ) : (
                managers.map((m, i) => (
                  <div key={m.cik} className="mgr-btn" onClick={() => setSelectedIdx(i)}
                    style={{ padding:'14px 16px', borderRadius:'4px', marginBottom:'4px', background:selectedIdx===i?'#f5f5f5':'transparent', borderLeft:selectedIdx===i?'2px solid #000':'2px solid transparent' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                      <p style={{ fontSize:'14px', fontWeight:selectedIdx===i?'500':'400', color:'#000', marginBottom:'2px' }}>
                        {m.name} ({m.nameKo})
                      </p>
                      {cache[m.cik]?.totalValue ? (
                        <span style={{ fontSize:'11px', color:'#aaa', flexShrink:0, marginLeft:'8px' }}>{formatValue(cache[m.cik].totalValue)}</span>
                      ) : null}
                    </div>
                    <p style={{ fontSize:'11px', color:'#aaa' }}>{m.firm}</p>
                  </div>
                ))
              )}
            </div>

            {/* 오른쪽 */}
            <div>
              <div style={{ marginBottom:'28px' }}>
                <h2 style={{ fontSize:'28px', fontWeight:'400', marginBottom:'6px' }}>{selectedManager.firm}</h2>
                {current?.period && <p style={{ fontSize:'13px', color:'#aaa', marginTop:'4px' }}>최신 공시 기준: {current.period}</p>}
              </div>

              {!current || current.loading ? (
                <div style={{ padding:'64px 0', display:'flex', justifyContent:'center' }}>
                  <div style={{
                    width:'28px', height:'28px', borderRadius:'50%',
                    border:'2px solid #e8e8e8', borderTopColor:'#000',
                    animation:'spin 0.8s linear infinite'
                  }} />
                </div>
              ) : current.error ? (
                <div style={{ padding:'32px', border:'1px solid #e8e8e8', borderRadius:'4px' }}>
                  <p style={{ fontSize:'14px', color:'#aaa', marginBottom:'8px' }}>데이터를 불러오지 못했습니다.</p>
                  <p style={{ fontSize:'12px', color:'#ccc', marginBottom:'16px' }}>{current.error}</p>
                  <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${selectedManager.cik}&type=13F-HR&dateb=&owner=include&count=10`} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none' }}>
                    <div className="edgar-link" style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'13px', color:'#000', borderBottom:'1px solid #000', paddingBottom:'2px', cursor:'pointer' }}>
                      SEC EDGAR에서 직접 보기 ↗
                    </div>
                  </a>
                </div>
              ) : (
                <>
                  <p style={{ fontSize:'11px', letterSpacing:'0.15em', textTransform:'uppercase', color:'#aaa', marginBottom:'16px' }}>Top 10 Holdings</p>
                  <DonutChart holdings={current.holdings} />

                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'14px', tableLayout:'fixed' }}>
                    <colgroup>
                      <col style={{ width:'32px' }} />
                      <col />
                      <col style={{ width:'110px' }} />
                      <col style={{ width:'90px' }} />
                      <col style={{ width:'110px' }} />
                      <col style={{ width:'130px' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ borderBottom:'1px solid #e8e8e8' }}>
                        <th style={{ textAlign:'left', padding:'10px 0', fontWeight:'400', color:'#aaa', fontSize:'11px' }}>#</th>
                        <th style={{ textAlign:'left', padding:'10px 0', fontWeight:'400', color:'#aaa', fontSize:'11px' }}>Stock</th>
                        <th style={{ textAlign:'right', padding:'10px 0', fontWeight:'400', color:'#aaa', fontSize:'11px' }}>% of Portfolio</th>
                        <th style={{ textAlign:'right', padding:'10px 0', fontWeight:'400', color:'#aaa', fontSize:'11px' }}>Shares</th>
                        <th style={{ textAlign:'right', padding:'10px 0', fontWeight:'400', color:'#aaa', fontSize:'11px' }}>Market Value</th>
                        <th style={{ textAlign:'right', padding:'10px 0', fontWeight:'400', color:'#aaa', fontSize:'11px' }}>Last Transaction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {current.holdings.map((h,i) => (
                        <tr key={i} className="table-row" style={{ borderBottom:'1px solid #f4f4f4' }}>
                          <td style={{ padding:'12px 0', color:'#bbb', fontSize:'12px' }}>{i+1}</td>
                          <td style={{ padding:'12px 0' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                              <StockLogo name={h.name} />
                              <span style={{ color:'#000', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'13px' }}>{formatName(h.name)}</span>
                            </div>
                          </td>
                          <td style={{ padding:'12px 0', textAlign:'right', color:'#555' }}>{h.pct}%</td>
                          <td style={{ padding:'12px 0', textAlign:'right', color:'#555', fontVariantNumeric:'tabular-nums' }}>{formatShares(h.shares)}</td>
                          <td style={{ padding:'12px 0', textAlign:'right', color:'#000', fontVariantNumeric:'tabular-nums' }}>{formatValue(h.value)}</td>
                          <td style={{ padding:'12px 0', textAlign:'right' }}><LastTransactionTag curr={h.shares} prev={h.prevShares} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ marginTop:'32px' }}>
                    <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${selectedManager.cik}&type=13F-HR&dateb=&owner=include&count=10`} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none' }}>
                      <div className="edgar-link" style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'13px', color:'#000', borderBottom:'1px solid #000', paddingBottom:'2px', cursor:'pointer' }}>
                        SEC EDGAR 원본 공시 보기 ↗
                      </div>
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <footer style={{ borderTop:'1px solid #e8e8e8', padding:'32px 48px', fontSize:'12px', color:'#aaa' }}>
          <span>Anthracite © 2026</span>
        </footer>
      </div>
    </>
  )
}