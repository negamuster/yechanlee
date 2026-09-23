import { portfolioSlices } from '../lib/financialMath'
import { useState, useEffect } from 'react'

interface Manager {
  name: string
  nameKo: string
  firm: string
  cik: string
  totalValue?: number; note?: string
}

const INITIAL_MANAGERS: Manager[] = [
  { name: 'Berkshire Hathaway', nameKo: '버크셔 해서웨이', firm: 'Berkshire Hathaway', cik: '0001067983' },
  { name: 'BlackRock', nameKo: '블랙록', firm: 'BlackRock Inc.', cik: '0002012383' },
  { name: 'Vanguard Group', nameKo: '뱅가드', firm: 'The Vanguard Group', cik: '0000102909', note: '기존 그룹 공시 기록입니다. 2026년 공시는 여러 운용 법인으로 나뉘어 제출되므로 그룹 전체의 최신 포트폴리오로 해석하지 마세요.' },
  { name: 'State Street', nameKo: '스테이트 스트리트', firm: 'State Street Corporation', cik: '0000093751' },
  { name: 'Bridgewater', nameKo: '브리지워터', firm: 'Bridgewater Associates', cik: '0001350694' },
  { name: 'Ken Griffin', nameKo: '켄 그리핀', firm: 'Citadel Advisors', cik: '0001423053' },
  { name: 'Renaissance', nameKo: '르네상스', firm: 'Renaissance Technologies', cik: '0001037389' },
  { name: 'Stanley Druckenmiller', nameKo: '스탠리 드러켄밀러', firm: 'Duquesne Family Office', cik: '0001536411' },
  { name: 'Bill Ackman', nameKo: '빌 애크먼', firm: 'Pershing Square Inc.', cik: '0002026053' },
  { name: 'David Tepper', nameKo: '데이비드 테퍼', firm: 'Appaloosa LP', cik: '0001656456' },
  { name: 'Soros Fund', nameKo: '소로스 펀드', firm: 'Soros Fund Management', cik: '0001029160' },
  { name: 'Cathie Wood', nameKo: '캐시 우드', firm: 'ARK Invest', cik: '0001697748' },
  { name: 'Li Lu', nameKo: '리 루', firm: 'Himalaya Capital', cik: '0001709323' },
  { name: 'Michael Burry', nameKo: '마이클 버리', firm: 'Scion Asset Management', cik: '0001649339', note: '최근 확인되는 보유 기준일을 확인하세요. 과거 공시이며 현재 보유를 의미하지 않습니다.' },
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
  name: string; shares: number; value: number; prevShares?: number; pct?: number; cusip: string; title: string
}
interface FilingData {
  filedAt?: string; checkedAt?: number; stale?: boolean; verification?: string; reportedTotal?: number; excludedValue?: number; holdingCount?: number; refreshError?: string
  sources?: { accession: string; form: string; indexUrl: string; reportedTotal: number; parsedTotal: number; reportedCount: number; parsedCount: number }[]
  period: string; holdings: Holding[]; loading: boolean; error: string | null; totalValue: number
}


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
  if (prev === undefined) return <span style={{ fontSize:'12px', color:'#666' }}>비교 자료 없음</span>
  if (prev === 0) return <span style={{ fontSize:'12px', color:'#16a34a' }}>New holding</span>
  if (curr === 0) return <span style={{ fontSize:'12px', color:'#ff3b30' }}>Sold out</span>
  const pct = Math.round(((curr - prev) / prev) * 100)
  if (pct > 0) return <span style={{ fontSize:'12px', color:'#16a34a' }}>+{pct}%</span>
  if (pct < 0) return <span style={{ fontSize:'12px', color:'#ff3b30' }}>{pct}%</span>
  return <span style={{ fontSize:'12px', color:'#aaa' }}>Unchanged</span>
}

function DonutChart({ holdings, total }: { holdings: Holding[]; total: number }) {
  const slices = portfolioSlices(holdings, total)
  let offset = 0
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:'24px', alignItems:'center', marginBottom:'32px' }}>
      <svg viewBox="0 0 200 200" role="img" aria-label="수집된 13F 보유금액 기준 상위 10개와 기타 종목 비중" style={{ width:180, flexShrink:0 }}>
        {slices.map((slice, i) => {
          const start = offset; offset += slice.fraction * 100
          return <circle key={i} cx="100" cy="100" r="66" fill="none" stroke={slice.other ? '#e8e8e8' : COLORS[i]}
            strokeWidth="28" pathLength="100" strokeDasharray={`${slice.fraction * 100} ${100 - slice.fraction * 100}`}
            strokeDashoffset={-start} transform="rotate(-90 100 100)">
            <title>{slice.name}: {slice.pct}%</title>
          </circle>
        })}
        <text x="100" y="94" textAnchor="middle" fontSize="13" fill="#000">{formatValue(total)}</text>
        <text x="100" y="112" textAnchor="middle" fontSize="10" fill="#666">수집 보유금액 합계</text>
      </svg>
      <div style={{ display:'flex', flexDirection:'column', gap:8, flex:1, minWidth:180 }}>
        {slices.map((slice, i) => <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:10, height:10, background:slice.other ? '#e8e8e8' : COLORS[i], flexShrink:0 }} />
          <span style={{ fontSize:12, color:'#333', flex:1 }}>{slice.other ? slice.name : formatName(slice.name)}</span>
          <span style={{ fontSize:12, color:'#666' }}>{slice.pct}%</span>
        </div>)}
        {!slices.length && <p>표시할 보유금액이 없습니다.</p>}
      </div>
    </div>
  )
}

export default function Form13F() {
  const managers = INITIAL_MANAGERS
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [cache, setCache] = useState<Record<string, FilingData>>({})
  const [refresh, setRefresh] = useState(0)
  const [busy, setBusy] = useState(false)
  const loadingAll = false
  const selectedManager = managers[selectedIdx]

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const cik = selectedManager.cik
    setBusy(true)
    async function load() {
      try {
        const response = await fetch(`/api/form13f?cik=${cik}`, { signal: controller.signal })
        const result = await response.json()
        if (!response.ok || result.verification !== 'matched') throw new Error(result.error || '공시 검증 실패')
        if (active) setCache(prev => ({ ...prev, [cik]: { ...result, loading:false, error:null } }))
      } catch (error) {
        if (active) setCache(prev => ({ ...prev, [cik]: prev[cik]?.holdings.length
          ? { ...prev[cik], stale:true, refreshError:'최신 공시를 다시 확인하지 못했습니다.' }
          : { period:'', holdings:[], totalValue:0, loading:false, error: error instanceof Error ? error.message : '조회 실패' } }))
      } finally { if (active) setBusy(false) }
    }
    void load()
    const interval = setInterval(() => { if (!document.hidden) setRefresh(value => value + 1) }, 15 * 60000)
    const visible = () => { if (!document.hidden) setRefresh(value => value + 1) }
    document.addEventListener('visibilitychange', visible)
    return () => { active = false; controller.abort(); clearInterval(interval); document.removeEventListener('visibilitychange', visible) }
  }, [selectedManager.cik, refresh])

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

        <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'40px 24px 80px' }}>
          <h1 className="page-title" style={{ fontSize:'52px', fontWeight:'400', letterSpacing:'-0.02em', marginBottom:'20px', lineHeight:'1.1' }}>기관 포트폴리오 · 13F</h1>
          <p className="page-desc" style={{ fontSize:'18px', lineHeight:'1.85', color:'#444', maxWidth:'720px', marginBottom:'32px', textAlign:'justify', wordBreak:'keep-all' }}>
            기관의 분기별 공시에서 보유 종목과 수량 변화를 확인합니다. 현재 보유나 실제 거래 시점과는 차이가 있습니다.
          </p>

          <details className="page-desc" style={{ padding:'16px 20px', border:'1px solid #e8e8e8', borderRadius:'4px', marginBottom:'28px', display:'flex', flexDirection:'column', gap:'10px' }}>
            <summary style={{ cursor:'pointer', fontSize:14 }}>공시를 읽기 전에</summary>
            {['분기말 보유 현황은 통상 분기 종료 후 45일 이내 제출됩니다. 보유 기준일과 제출일을 구분하세요.',
              '미국 상장 주식 중심 - 현금, 채권, 공매도(Short), 비상장 투자, 해외 주식 상당수는 포함되지 않습니다.',
              '복사 매매 주의 - 공시 데이터만으로 투자 결정을 내리는 것은 위험할 수 있습니다.',
            ].map((t,i) => <p key={i} style={{ fontSize:'14px', color:'#666', lineHeight:'1.6' }}>{t}</p>)}
            <a href="https://www.sec.gov/files/form13f.pdf" target="_blank" rel="noopener noreferrer">SEC Form 13F 안내 ↗</a>
          </details>

          <div className="page-section portfolio-layout" style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:'48px', alignItems:'start' }}>

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
                  <div key={m.cik} className="mgr-btn" role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedIdx(i) } }} onClick={() => setSelectedIdx(i)}
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
              {!loadingAll && (
              <div style={{ marginBottom:'28px' }}>
                <h2 style={{ fontSize:'28px', fontWeight:'400', marginBottom:'6px' }}>{selectedManager.firm}</h2>
                {selectedManager.note && <p style={{ color:'#9a6700', fontSize:12, lineHeight:1.7 }}>{selectedManager.note}</p>}
                {current?.period && Date.now() - Date.parse(current.period) > 180 * 86400000 && <p style={{ color:'#9a6700', fontSize:12 }}>보유 기준일로부터 6개월 이상 지난 공시입니다.</p>}
                <button type="button" disabled={busy} onClick={() => setRefresh(value => value + 1)}>{busy ? '공시 확인 중…' : '새로고침'}</button>
                <p style={{ fontSize:12, color:'#666', lineHeight:1.7 }}>선택한 기관은 페이지를 보는 동안 15분마다 확인합니다. 서버 캐시는 최대 15분이며 새 공시는 재배포 없이 반영됩니다.</p>
                {current?.checkedAt && <p style={{ fontSize:12, color:'#666' }}>최근 검증: {new Date(current.checkedAt).toLocaleString('ko-KR', { timeZone:'Asia/Seoul' })} KST</p>}
                {current?.stale && <p role="status" style={{ color:'#b42318' }}>최신 조회에 실패해 마지막 검증 자료를 표시합니다.</p>}
                {current && !current.loading && !current.error && <p style={{ fontSize:'13px', color:'#aaa', marginTop:'4px' }}>보유 기준일: {current.period || '미확인'} · 제출일: {current.filedAt || '미확인'}</p>}
              </div>
              )}

              {loadingAll ? null : !current || current.loading ? (
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
                  <details style={{ fontSize:12, lineHeight:1.8, marginBottom:24 }}>
                    <summary>SEC 원문 대조: 공시별 금액 합계·행 수 일치</summary>
                    <p>옵션·원금 단위 항목 포함 공시 합계: {formatValue(current.reportedTotal ?? 0)} · 화면에서 제외한 금액: {formatValue(current.excludedValue ?? 0)}</p>
                    {current.sources?.map(source => <p key={source.accession}>
                      <a href={source.indexUrl} target="_blank" rel="noopener noreferrer">{source.form} · {source.accession} ↗</a><br />
                      원문 / 수집: ${source.reportedTotal.toLocaleString()} / ${source.parsedTotal.toLocaleString()} · {source.reportedCount} / {source.parsedCount}행
                    </p>)}
                    <p>합계 대조는 파싱 검증이며 SEC가 투자 내용을 보증한다는 뜻은 아닙니다. 수정 공시는 재작성과 추가 보유 항목을 구분해 반영합니다.</p>
                  </details>
                  <p style={{ fontSize:'11px', letterSpacing:'0.15em', textTransform:'uppercase', color:'#aaa', marginBottom:'16px' }}>Top 10 Holdings</p>
                  <DonutChart holdings={current.holdings} total={current.totalValue} />
                  <p style={{ fontSize:12, color:'#666', lineHeight:1.7, marginBottom:20 }}>차트와 표의 비중은 옵션·원금 단위 항목을 제외한 보유종목 전체 합계를 기준으로 합니다. 차트는 상위 10개와 기타, 표는 상위 30개를 표시합니다. 기타에는 표에 없는 종목도 포함됩니다. 옵션 등 제외 항목이 있어 기관의 전체 운용자산(AUM)과 다르며, 반올림으로 비중 합계가 100%와 다를 수 있습니다.</p>

                  <div style={{ overflowX:'auto' }}><table style={{ width:'100%', minWidth:620, borderCollapse:'collapse', fontSize:'14px', tableLayout:'fixed' }}>
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
                        <th style={{ textAlign:'right', padding:'10px 0', fontWeight:'400', color:'#aaa', fontSize:'11px' }}>전 분기 수량 변화</th>
                      </tr>
                    </thead>
                    <tbody>
                      {current.holdings.map((h,i) => (
                        <tr key={i} className="table-row" style={{ borderBottom:'1px solid #f4f4f4' }}>
                          <td style={{ padding:'12px 0', color:'#bbb', fontSize:'12px' }}>{i+1}</td>
                          <td style={{ padding:'12px 0' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                              <StockLogo name={h.name} />
                              <span style={{ color:'#000', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'13px' }}>{formatName(h.name)}<small style={{ display:'block', color:'#666', fontSize:10 }}>{h.title} · {h.cusip}</small></span>
                            </div>
                          </td>
                          <td style={{ padding:'12px 0', textAlign:'right', color:'#555' }}>{h.pct}%</td>
                          <td style={{ padding:'12px 0', textAlign:'right', color:'#555', fontVariantNumeric:'tabular-nums' }}>{formatShares(h.shares)}</td>
                          <td style={{ padding:'12px 0', textAlign:'right', color:'#000', fontVariantNumeric:'tabular-nums' }}>{formatValue(h.value)}</td>
                          <td style={{ padding:'12px 0', textAlign:'right' }}><LastTransactionTag curr={h.shares} prev={h.prevShares} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>

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