import { useState } from 'react'
import { useResource } from '../hooks/useResource'
import { refreshPolicies } from '../lib/refreshPolicy'
import ToolPage from '../components/ToolPage'
import ResourceState from '../components/ResourceState'
import WidgetActions from '../components/WidgetActions'
import { portfolioSlices } from '../lib/financialMath'
import { formatHoldingValue, isFiling } from '../lib/form13fPresentation'
import { DEFAULT_HOLDINGS_SORTING } from '../lib/holdingsTable'
import type { SortingState } from '@tanstack/react-table'
import FullHoldingsTable from '../components/FullHoldingsTable'
import InstitutionComparison from '../components/InstitutionComparison'
import type { Holding } from '../lib/form13fPresentation'
import { dataTime } from '../utils/dataTime'

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
  { name: 'Baupost Group', nameKo: '바우포스트', firm: 'Baupost Group LLC/MA', cik: '0001061768' },
  { name: 'Dodge & Cox', nameKo: '닷지 앤 콕스', firm: 'Dodge & Cox', cik: '0000200217' },
  { name: 'Third Point', nameKo: '서드 포인트', firm: 'Third Point LLC', cik: '0001040273' },
]


const COLORS = ['#334155', '#52738f', '#8aacc2', '#5b8580', '#a3b9c5', '#76849b', '#70949d', '#bccbd7', '#97aaa2', '#d1dbe3']
function DonutChart({ holdings, total }: { holdings: Holding[]; total: number }) {
  const slices = portfolioSlices(holdings, total)
  return <div className="portfolio-donut">
    <svg viewBox="0 0 200 200" role="img" aria-label="전체 수집 보유금액 기준 상위 10개와 기타 종목 비중">
      {slices.map((slice, index) => {
        const start = slices.slice(0, index).reduce((sum, previous) => sum + previous.fraction * 100, 0)
        return <circle key={index} cx="100" cy="100" r="66" fill="none" stroke={slice.other ? '#e2e8f0' : COLORS[index]}
          strokeWidth="26" pathLength="100" strokeDasharray={`${slice.fraction * 100} ${100 - slice.fraction * 100}`}
          strokeDashoffset={-start} transform="rotate(-90 100 100)"><title>{slice.name}: {slice.pct}%</title></circle>
      })}
      <text x="100" y="96" textAnchor="middle" className="portfolio-donut-value">{formatHoldingValue(total)}</text>
      <text x="100" y="114" textAnchor="middle" className="portfolio-donut-label">수집 보유금액</text>
    </svg>
    <ul className="portfolio-legend">{slices.map((slice, index) => <li key={index}>
      <span className="portfolio-swatch" style={{ background: slice.other ? '#e2e8f0' : COLORS[index] }} aria-hidden="true" />
      <span>{slice.name}</span><strong>{slice.pct}%</strong>
    </li>)}</ul>
  </div>
}

export default function Form13F() {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [openedAt] = useState(Date.now)
  const [refresh, setRefresh] = useState(0)
  const [compare, setCompare] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortingState>(DEFAULT_HOLDINGS_SORTING)
  const selectedManager = INITIAL_MANAGERS[selectedIdx]
  const { data: current, loading: busy, error: failed } = useResource(`/api/form13f?cik=${selectedManager.cik}`, isFiling, refreshPolicies.filings, refresh)
  const edgarUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${selectedManager.cik}&type=13F-HR&dateb=&owner=include&count=10`

  function selectManager(index: number) {
    setSelectedIdx(index); setQuery(''); setSort(DEFAULT_HOLDINGS_SORTING)
  }

  return <ToolPage className="portfolio-page" title="기관 포트폴리오 · 13F"
    description="기관의 분기별 공시에서 보유 종목과 수량 변화를 확인합니다. 현재 보유나 실제 거래 시점과는 차이가 있습니다.">
    <div className="portfolio-layout">
      <aside className="tool-card portfolio-managers" aria-label="기관 선택">
        <div className="tool-card-heading"><h2>기관</h2><span className="tool-meta">{INITIAL_MANAGERS.length}</span></div>
        <label className="portfolio-manager-select">기관 선택
          <select value={selectedIdx} onChange={event => selectManager(Number(event.target.value))}>
            {INITIAL_MANAGERS.map((manager, index) => <option key={manager.cik} value={index}>{manager.nameKo} · {manager.firm}</option>)}
          </select>
        </label>
        <nav className="portfolio-manager-list" aria-label="13F 기관 목록">{INITIAL_MANAGERS.map((manager, index) => <button
          key={manager.cik} type="button" className="portfolio-manager" aria-pressed={selectedIdx === index} onClick={() => selectManager(index)}>
          <strong>{manager.nameKo}</strong><span>{manager.firm}</span>
        </button>)}</nav>
      </aside>
      <div className="portfolio-main">
        <section className="tool-card portfolio-overview" aria-labelledby="portfolio-heading" aria-busy={busy}>
          <div className="tool-card-heading"><h2 id="portfolio-heading">{selectedManager.firm}</h2>
            <WidgetActions label="13F 공시" refresh={{ loading: busy, onClick: () => setRefresh(value => value + 1) }} />
          </div>
          {selectedManager.note && <p className="tool-callout">{selectedManager.note}</p>}
          {current?.period && Math.max(openedAt, current.checkedAt ?? 0) - Date.parse(current.period) > 180 * 86400000 && <p className="tool-callout">보유 기준일로부터 6개월 이상 지난 공시입니다.</p>}
          <ResourceState label="13F 공시" loading={busy} error={failed} hasData={!!current} stale={current?.stale}
            updatedAt={current?.checkedAt} onRetry={() => setRefresh(value => value + 1)} layout="rows"
            failureMessage={failed && current ? '최신 조회에 실패해 마지막 검증 자료를 표시합니다.' : undefined} />
          {current && <>
            <dl className="portfolio-summary">
              <div><dt>수집 보유금액</dt><dd>{formatHoldingValue(current.totalValue)}</dd></div>
              <div><dt>보유 기준일</dt><dd>{current.period || '미확인'}</dd></div>
              <div><dt>제출일</dt><dd>{current.filedAt || '미확인'}</dd></div>
            </dl>
            <p className="tool-meta portfolio-verified">SEC 원문 합계·행 수 대조 완료 · 최근 검증 {dataTime(current.checkedAt)}</p>
          </>}
          <a className="tool-text-link" href={edgarUrl} target="_blank" rel="noopener noreferrer">SEC EDGAR 원문 ↗</a>
        </section>
        {current && <div className="portfolio-mode" role="group" aria-label="포트폴리오 보기 방식"><button className="tool-button" type="button" aria-pressed={!compare} onClick={() => setCompare(false)}>전체 내역</button><button className="tool-button" type="button" aria-pressed={compare} onClick={() => setCompare(true)}>기관 비교</button></div>}
        {current && compare && <InstitutionComparison key={selectedManager.cik} manager={selectedManager} managers={INITIAL_MANAGERS} filing={current} revision={refresh} onRefresh={() => setRefresh(n => n + 1)} />}
        {current && !compare && (current.holdings.length ? <>
          <section className="tool-card" aria-labelledby="portfolio-allocation-heading">
            <div className="tool-card-heading"><h3 id="portfolio-allocation-heading">상위 10개 보유 비중</h3><span className="tool-meta">기타 포함</span></div>
            <DonutChart holdings={current.holdings} total={current.totalValue} />
          </section>
          <FullHoldingsTable key={`${selectedManager.cik}:${current.period}`} filing={{ ...current, stale: current.stale || failed }} cik={selectedManager.cik} query={query} setQuery={setQuery} sort={sort} setSort={setSort} />
        </> : <><div className="tool-card tool-empty" role="status">표시할 주식 보유 종목이 없습니다.</div><FullHoldingsTable key={`${selectedManager.cik}:${current.period}`} filing={current} cik={selectedManager.cik} query={query} setQuery={setQuery} sort={sort} setSort={setSort} /></>)}
        <details className="tool-card tool-disclosure">
          <summary>공시·산정 기준</summary>
          <div className="tool-disclosure-content">
            <p>분기말 보유 현황은 통상 분기 종료 후 45일 이내 제출됩니다. 보유 기준일과 제출일을 구분하세요.</p>
            <p>미국 상장 주식 중심이며 현금·채권·공매도·비상장 투자와 해외 주식 상당수는 포함되지 않습니다.</p>
            <p>차트·표의 비중은 옵션·원금 단위 항목을 제외한 전체 보유금액 기준입니다. 차트는 상위 10개와 기타, 표는 수집·검증한 전체 SH 항목을 표시합니다. 기관의 전체 운용자산(AUM)과 다르며 반올림으로 비중 합계가 100%와 다를 수 있습니다.</p>
            <p>수량 변화는 바로 전 분기 대비 증감률입니다. 주식 분할·기업 행동·비공개 처리·수정 공시의 영향을 받을 수 있어 매매량으로 단정할 수 없습니다. 신규 보유·비교 자료 없음은 숫자로 환산하지 않으며 증감률 정렬 시 수치가 있는 항목 뒤에 표시합니다.</p>
            <p>선택한 기관은 화면을 보는 동안 15분마다 확인합니다. 서버 캐시는 최대 15분이며 새 공시는 재배포 없이 반영됩니다.</p>
            {current?.sources && <div className="portfolio-sources">
              <p>공시 합계: {formatHoldingValue(current.reportedTotal ?? 0)} · 표시 대상에서 제외한 금액: {formatHoldingValue(current.excludedValue ?? 0)}</p>
              {current.sources.map(source => <p key={source.accession}>
                <a className="tool-text-link" href={source.indexUrl} target="_blank" rel="noopener noreferrer">{source.form} · {source.accession} ↗</a><br />
                원문 / 수집: ${source.reportedTotal.toLocaleString('en-US')} / ${source.parsedTotal.toLocaleString('en-US')} · {source.reportedCount} / {source.parsedCount}행
              </p>)}
              <p>합계 대조는 파싱 검증이며 SEC가 투자 내용을 보증한다는 뜻은 아닙니다. 수정 공시는 재작성과 추가 보유 항목을 구분해 반영합니다.</p>
            </div>}
            <a className="tool-text-link" href="https://www.sec.gov/files/form13f.pdf" target="_blank" rel="noopener noreferrer">SEC Form 13F 안내 ↗</a>
          </div>
        </details>
      </div>
    </div>
  </ToolPage>
}
