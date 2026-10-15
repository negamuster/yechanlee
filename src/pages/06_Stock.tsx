import { useReturnOrigin } from '../hooks/useReturnOrigin'
import { useId, useState } from 'react'
import type { PointerEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useReadArticles } from '../hooks/useReadArticles'
import { BookmarkButton, WatchButton } from '../components/SavedItemsProvider'
import { useStockSnapshot } from '../hooks/useStockSnapshot'
import { quoteFromBars } from '../lib/stockSnapshot'
import type { DailyBar } from '../lib/stockSnapshot'
import { nearestStockBar, stockChartWindow, stockMoney, stockNumber, stockPercent } from '../lib/stockPresentation'
import { isWebUrl } from '../lib/watchlist'
import ReturnToList from '../components/ReturnToList'
import './Stock.css'

const periods = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 } as const
const tradingDate = (at: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
const tone = (value: number | null) => value === null || value === 0 ? 'neutral' : value > 0 ? 'up' : 'down'
type Figure = { value?: unknown; unit?: unknown } | undefined
function figureCurrency(field: Figure) {
  return typeof field?.unit === 'string' ? field.unit.toUpperCase().match(/^([A-Z]{3})(?:\s*\/\s*SHARES?)?$/)?.[1] : undefined
}
function sameCurrency(a: Figure, b: Figure) { return !!figureCurrency(a) && figureCurrency(a) === figureCurrency(b) }
function figureMoney(field: Figure) {
  const value = stockNumber(field?.value), currency = figureCurrency(field)
  if (value === null) return '—'
  return currency ? stockMoney(value, currency, true) : `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${typeof field?.unit === 'string' ? field.unit : '단위 미제공'}`
}
interface Story { id?: string; title: string; article_url: string; published_utc: string; publisher: { name: string }; image_url?: string }
function validStory(value: unknown): value is Story {
  const item = value as Story | null
  return !!item && typeof item.title === 'string' && isWebUrl(item.article_url) && typeof item.publisher?.name === 'string' && Number.isFinite(Date.parse(item.published_utc))
}
function NewsThumbnail({ url }: { url?: string }) {
  const [failed, setFailed] = useState(false)
  return url?.startsWith('https://') && !failed ? <img className="stock-news-thumb" src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : null
}
function Metrics({ items }: { items: { label: string; value: string; note?: string }[] }) {
  return <dl className="stock-metrics">{items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}{item.note && <small>{item.note}</small>}</dd></div>)}</dl>
}
function PriceChart({ bars, currency, changePercent }: { bars: DailyBar[]; currency: string; changePercent: number | null }) {
  const chartId = useId()
  const [active, setActive] = useState<number | null>(null)
  if (bars.length < 2) return null
  const W = 1000, H = 240
  const prices = bars.map(bar => bar.c)
  const low = Math.min(...prices), high = Math.max(...prices)
  const margin = Math.max((high - low) * .08, high * .002)
  const min = low - margin, max = high + margin
  const start = bars[0].t, end = bars.at(-1)!.t
  const x = (at: number) => (at - start) / (end - start || 1) * W
  const y = (price: number) => 12 + (max - price) / (max - min) * (H - 24)
  const points = bars.map(bar => `${x(bar.t)},${y(bar.c)}`).join(' ')
  const selected = bars[Math.min(active ?? bars.length - 1, bars.length - 1)]
  const ticks = [...new Set([0, Math.floor(bars.length / 4), Math.floor(bars.length / 2), Math.floor(bars.length * .75), bars.length - 1])]
  function select(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width) setActive(nearestStockBar(bars, (event.clientX - bounds.left) / bounds.width))
  }
  return <div className={`stock-price-chart stock-${tone(changePercent)}`}>
    <div className="stock-chart-readout" role="status" aria-live="polite"><time dateTime={tradingDate(selected.t)}>{tradingDate(selected.t)} 미국 거래일</time><strong>{stockMoney(selected.c, currency)}</strong><span>종가</span></div>
    <div className="stock-chart-frame" tabIndex={0} role="group" aria-label="날짜별 종가 차트" aria-describedby={`${chartId}-help`} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      setActive(index => event.key === 'Home' ? 0 : event.key === 'End' ? bars.length - 1 : Math.max(0, Math.min(bars.length - 1, (index ?? bars.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1))))
    }}>
      <div className="stock-chart-y-labels" aria-hidden="true">{[max, (max + min) / 2, min].map((price, index) => <span key={index} style={{ top: `${(12 + index * (H - 24) / 2) / H * 100}%` }}>{stockMoney(price, currency, Math.abs(price) >= 10000)}</span>)}</div>
      <div className="stock-chart-drawing">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-labelledby={`${chartId}-title`} onPointerMove={select} onPointerDown={select} onPointerLeave={event => { if (event.pointerType === 'mouse') setActive(null) }}>
          <title id={`${chartId}-title`}>{tradingDate(start)}부터 {tradingDate(end)}까지 일별 종가. 선택 기간 등락률 {stockPercent(changePercent, true)}.</title>
          <defs><linearGradient id={`${chartId}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".12" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
          {[12, H / 2, H - 12].map(at => <line key={at} x1="0" x2={W} y1={at} y2={at} className="stock-chart-gridline" vectorEffect="non-scaling-stroke" />)}
          <polygon points={`0,${H} ${points} ${W},${H}`} fill={`url(#${chartId}-fill)`} />
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <line x1={x(selected.t)} x2={x(selected.t)} y1="0" y2={H} stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" opacity=".4" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="stock-chart-dot" aria-hidden="true" style={{ left: `${x(selected.t) / W * 100}%`, top: `${y(selected.c) / H * 100}%` }} />
      </div>
    </div>
    <div className={`stock-chart-x-labels${ticks.length > 3 ? ' many-ticks' : ''}`} aria-hidden="true">{ticks.map(index => <span key={index} style={{left: `${x(bars[index].t) / W * 100}%`}}>{tradingDate(bars[index].t).slice(5).replace('-', '.')}</span>)}</div>
    <p id={`${chartId}-help`} className="stock-note">차트 위에서 날짜별 종가를 확인하세요. 키보드: ← → 이동 · Home/End 처음·마지막.</p>
  </div>
}

export default function Stock() {
  const { ticker } = useParams<{ ticker: string }>()
  const symbol = ticker?.toUpperCase() || ''
  const { snapshot, loading, error, refresh } = useStockSnapshot(symbol)
  const { isRead, mark } = useReadArticles()
  const [period, setPeriod] = useState<keyof typeof periods>('3M')
  const [aboutOpen, setAboutOpen] = useState(false)
  const aboutId = useId()
  const returnState = useReturnOrigin()
  const details = snapshot?.details
  const bars = snapshot?.bars ?? []
  const quote = quoteFromBars(bars)
  const chart = stockChartWindow(bars, periods[period])
  const currency = typeof details?.currency_name === 'string' && /^[a-z]{3}$/i.test(details.currency_name) ? details.currency_name.toUpperCase() : 'USD'
  const financials = snapshot?.financials ?? []
  const annual = financials[0], previousAnnual = financials[1]
  const fin = annual?.financials, previousFin = previousAnnual?.financials
  const epsField = fin?.income_statement?.diluted_earnings_per_share
  const revenueField = fin?.income_statement?.revenues
  const previousRevenueField = previousFin?.income_statement?.revenues
  const incomeField = fin?.income_statement?.net_income_loss
  const equityField = fin?.balance_sheet?.equity
  const liabilitiesField = fin?.balance_sheet?.liabilities
  const eps = stockNumber(epsField?.value), revenue = stockNumber(revenueField?.value), previousRevenue = stockNumber(previousRevenueField?.value)
  const income = stockNumber(incomeField?.value), equity = stockNumber(equityField?.value), liabilities = stockNumber(liabilitiesField?.value)
  const pe = eps !== null && eps > 0 && quote.latest && figureCurrency(epsField) === currency ? quote.latest.c / eps : null
  const roe = income !== null && equity !== null && equity > 0 && sameCurrency(incomeField, equityField) ? income / equity * 100 : null
  const debtEquity = liabilities !== null && equity !== null && equity > 0 && sameCurrency(liabilitiesField, equityField) ? liabilities / equity : null
  const growth = revenue !== null && previousRevenue !== null && previousRevenue > 0 && sameCurrency(revenueField, previousRevenueField) && previousAnnual?.end_date < annual?.start_date ? (revenue / previousRevenue - 1) * 100 : null
  const hasFinancials = [eps, revenue, income, equity, liabilities].some(value => value !== null)
  const hasHistory = snapshot?.historyAvailable ?? false
  const rangePosition = hasHistory && quote.latest && quote.high !== null && quote.low !== null && quote.high > quote.low ? (quote.latest.c - quote.low) / (quote.high - quote.low) * 100 : null
  const articles = (snapshot?.news ?? []).filter(validStory)
  const related = snapshot?.related ?? []
  const partial = !!snapshot?.issues.length
  const financialMetrics = [
    { label: '연간 매출', value: figureMoney(revenueField) },
    { label: '연간 순이익', value: figureMoney(incomeField) },
    { label: '연간 희석 EPS', value: figureMoney(epsField) },
    { label: 'P/E', value: pe === null ? '—' : `${pe.toFixed(1)}x`, note: '최근 종가 ÷ 연간 희석 EPS' },
    { label: 'ROE', value: stockPercent(roe), note: '기말 자기자본 기준' },
    { label: '연간 매출 성장률', value: stockPercent(growth), note: '확인된 이전 연간 기간 대비' },
  ]
  return <>
    <main className="stock-page">
      <div className="stock-top-nav"><ReturnToList /><nav className="stock-breadcrumb" aria-label="현재 위치"><Link to="/markets">시장</Link><span aria-hidden="true">/</span><span>{symbol}</span></nav></div>
      {loading && !snapshot ? <section className="stock-loading" aria-busy="true"><h1>{symbol}</h1><p role="status">종목 정보와 시세를 불러오는 중…</p><div className="stock-skeleton" aria-hidden="true"><div /><div /><div /></div></section>
        : error && !snapshot ? <section className="stock-empty" role="alert"><h1>{symbol} 종목 정보</h1><p>{error}</p><div className="stock-actions"><button type="button" onClick={refresh}>다시 조회</button><Link to="/markets">시장으로 돌아가기 →</Link></div></section>
        : snapshot && details ? <>
          <section className="stock-card stock-hero" aria-labelledby="stock-company-title">
            <div className="stock-identity-row"><div className="stock-identity"><span className="stock-symbol">{symbol}</span><div><p className="stock-note">{[details.primary_exchange, details.sic_description].filter(Boolean).join(' · ') || '미국 상장 종목'}</p><h1 id="stock-company-title">{details.name}</h1></div></div>
              <div className="stock-actions"><WatchButton ticker={symbol} name={details.name} /><button type="button" disabled={loading} onClick={refresh}>{loading ? '조회 중…' : '새로고침'}</button></div>
            </div>
            <div className="stock-price-line"><strong className="stock-current-price">{stockMoney(quote.latest?.c, currency)}</strong><span className={`stock-price-change stock-${tone(quote.change)}`}>{quote.change === null ? '전 거래일 대비 미확인' : `${quote.change > 0 ? '+' : ''}${stockMoney(quote.change, currency)} (${stockPercent(quote.changePct, true)})`}</span></div>
            <p className="stock-price-basis">{quote.tradingDate} 미국 거래일 · 일별 집계 종가 · {currency} · 실시간 아님</p>
            <Metrics items={[
              {label:'시가',value:stockMoney(quote.latest?.o,currency)}, {label:'당일 고가',value:stockMoney(quote.latest?.h,currency)},
              {label:'당일 저가',value:stockMoney(quote.latest?.l,currency)}, {label:'직전 거래일 종가',value:stockMoney(quote.previous?.c,currency),note:quote.previousDate ?? '비교일 미확인'},
            ]} />
            <div className="stock-refresh-status"><span className={`stock-state${error || partial ? ' is-partial' : ''}`}>{error ? '이전 조회 자료' : partial ? '일부 자료 미확인' : '조회 완료'}</span><span>조회 {new Date(snapshot.fetchedAt).toLocaleString('ko-KR', {timeZone:'Asia/Seoul',hour12:false})} KST</span></div>
            {error && <p className="stock-alert" role="status">{error}</p>}
            {!hasHistory && <p className="stock-alert" role="status">가격 이력을 받지 못해 확인된 최근 종가를 표시합니다. 전일 대비와 조회 기간 고가·저가는 미확인입니다.</p>}
            <details className="stock-data-details"><summary>가격·자료 기준</summary><p>Polygon / Massive · 주식분할 조정 일별 집계 · {quote.previousDate ?? '미확인'} 종가와 비교 · 페이지가 열려 있는 동안 5분 간격 확인</p>{partial && <p>이번 조회에서 받지 못한 자료: {snapshot.issues.join(' · ')}</p>}<p>시가총액은 기업정보 응답 기준이며 위 종가와 관측 시점이 다를 수 있습니다.</p></details>
          </section>
          <nav className="stock-section-nav" aria-label="종목 정보 바로가기"><a href="#stock-chart">차트</a><a href="#stock-financials">핵심 재무</a><a href="#stock-news">관련 뉴스</a><a href="#stock-about">기업 정보</a></nav>
          <section id="stock-chart" className="stock-card" aria-labelledby="stock-chart-title">
            <div className="stock-section-heading"><div><h2 id="stock-chart-title">주가 차트</h2><p className="stock-note">일별 종가 · 주식분할 조정</p></div><div className="stock-periods" role="group" aria-label="차트 조회 기간">{(Object.keys(periods) as (keyof typeof periods)[]).map(value => <button type="button" key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value}</button>)}</div></div>
            {hasHistory && chart.bars.length > 1 ? <><p className="stock-chart-period">{tradingDate(chart.first!.t)} ~ {tradingDate(chart.last!.t)} <strong className={`stock-${tone(chart.changePercent)}`}>{stockPercent(chart.changePercent, true)}</strong><span>표시 기간 첫 종가 대비</span></p><PriceChart key={`${symbol}-${period}`} bars={chart.bars} currency={currency} changePercent={chart.changePercent} /></> : <p className="stock-empty-note" role="status">{hasHistory ? '이 기간의 차트를 그릴 만큼 일별 시세가 충분하지 않습니다.' : '가격 이력을 불러오지 못했습니다. 새로고침으로 다시 확인해 주세요.'}</p>}
          </section>
          <div className="stock-detail-grid"><div className="stock-main-column">
            <section id="stock-financials" className="stock-card" aria-labelledby="stock-financials-title"><div className="stock-section-heading"><h2 id="stock-financials-title">핵심 재무·가격 정보</h2><span className="stock-note">확인된 자료 기준</span></div>
              <Metrics items={[{label:'시가총액',value:stockMoney(details.market_cap,currency,true),note:'기업정보 기준'},{label:'1년 조회 고가',value:stockMoney(hasHistory ? quote.high : null,currency),note:'일별 고가 중 최댓값'},{label:'1년 조회 저가',value:stockMoney(hasHistory ? quote.low : null,currency),note:'일별 저가 중 최솟값'}]} />
              {hasFinancials ? <><p className="stock-financial-period">연간 회계기간 {annual.start_date ?? '미확인'} ~ {annual.end_date ?? '미확인'} · 제출 {annual.filing_date ?? '미확인'}</p><Metrics items={financialMetrics} /></> : <div className="stock-empty-note" role="status"><strong>{snapshot.issues.includes('연간 재무') ? '연간 재무 자료 조회 실패' : '제공된 연간 재무 자료가 없습니다.'}</strong><p>{snapshot.issues.includes('연간 재무') ? '새로고침으로 다시 확인할 수 있습니다.' : '이 종목에서 확인되지 않은 재무 수치는 미확인으로 표시합니다.'}</p></div>}
              <details className="stock-data-details"><summary>추가 비율·계산 기준</summary><dl className="stock-extra-metrics"><div><dt>총부채 / 자기자본</dt><dd>{debtEquity === null ? '—' : `${debtEquity.toFixed(2)}x`}</dd></div><div><dt>조회 범위 내 종가 위치</dt><dd>{stockPercent(rangePosition)}</dd></div></dl><p>P/E는 양수인 연간 희석 EPS로 계산합니다. ROE는 기말 자기자본 기준입니다. 총부채에는 이자부 차입금 외 부채도 포함합니다. 비율은 비교 가능한 통화·기간이 확인된 경우에 표시합니다.</p><p>고가·저가는 최대 1년 내 수집된 일별 자료 기준입니다. {hasHistory && bars[0] ? `조회 범위: ${tradingDate(bars[0].t)} ~ ${quote.tradingDate}. ` : ''}신규 상장이나 자료 누락으로 1년 전체가 아닐 수 있습니다. ‘—’는 미확인이거나 계산 조건을 충족하지 않은 값입니다.</p></details>
            </section>
            <section id="stock-news" className="stock-card" aria-labelledby="stock-news-title"><div className="stock-section-heading"><h2 id="stock-news-title">관련 뉴스</h2><span className="stock-note">{articles.length ? `${articles.length}건 · 원문으로 이동` : '종목별 기사'}</span></div>
              {articles.length ? <ul className="stock-news-list">{articles.map(article => <li key={article.id ?? article.article_url} className={isRead(article.article_url) ? 'is-read' : undefined}>
                <a className="stock-news-link" href={article.article_url} target="_blank" rel="noopener noreferrer" onClick={() => mark(article.article_url)} onAuxClick={event => {if(event.button === 1) mark(article.article_url)}}><NewsThumbnail key={article.image_url} url={article.image_url} /><div><p className="stock-note">{article.publisher.name} · <time dateTime={article.published_utc}>{new Date(article.published_utc).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})} KST</time>{isRead(article.article_url) && <span className="stock-read-badge">읽음</span>}</p><h3>{article.title}</h3><span className="stock-news-original">원문 읽기 ↗</span></div></a>
                <BookmarkButton article={{article_url:article.article_url,title:article.title,publisher:article.publisher.name,published_utc:article.published_utc}} />
              </li>)}</ul> : <p className="stock-empty-note" role="status">{snapshot.issues.includes('뉴스') ? '뉴스를 불러오지 못했습니다. 새로고침으로 다시 확인해 주세요.' : '이번 조회에서 제공된 관련 기사가 없습니다.'}</p>}
            </section>
          </div><aside className="stock-side-column" aria-label="기업 정보와 관련 종목">
            <section id="stock-about" className="stock-card" aria-labelledby="stock-about-title"><div className="stock-section-heading"><h2 id="stock-about-title">기업 정보</h2></div><dl className="stock-company-facts"><div><dt>티커</dt><dd>{symbol}</dd></div><div><dt>거래소</dt><dd>{details.primary_exchange ?? '—'}</dd></div><div><dt>상장일</dt><dd>{details.list_date ?? '—'}</dd></div>{stockNumber(details.total_employees) !== null && <div><dt>직원 수</dt><dd>{details.total_employees.toLocaleString('ko-KR')}명</dd></div>}</dl>
              {typeof details.description === 'string' && details.description && <><p id={aboutId} className={`stock-company-description${aboutOpen ? ' is-open' : ''}`}>{details.description}</p><button type="button" className="stock-text-button" aria-expanded={aboutOpen} aria-controls={aboutId} onClick={() => setAboutOpen(value => !value)}>{aboutOpen ? '설명 접기 −' : '사업 설명 더 보기 +'}</button></>}
              {isWebUrl(details.homepage_url) && <a className="stock-company-website" href={details.homepage_url} target="_blank" rel="noopener noreferrer">기업 웹사이트 ↗</a>}
            </section>
            <section className="stock-card" aria-labelledby="stock-related-title"><div className="stock-section-heading"><h2 id="stock-related-title">관련 종목</h2></div>{related.length ? <div className="stock-related-links">{related.map(ticker => <Link key={ticker} to={`/stock/${encodeURIComponent(ticker)}`} state={returnState}>{ticker} →</Link>)}</div> : <p className="stock-note">{snapshot.issues.includes('관련 종목') ? '관련 종목을 불러오지 못했습니다.' : '제공된 관련 종목이 없습니다.'}</p>}</section>
          </aside></div>
        </> : null}
    </main>
    <footer className="stock-footer">Anthracite © 2026</footer>
  </>
}
