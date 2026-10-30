import type { EvidenceSource } from './evidence'
import type { Briefing } from './briefings'
import { financialBasis, financialMetrics } from './financialHistory.ts'
import type { FinancialPeriod } from './financialHistory'
import type { FilingData, Holding } from './form13fPresentation'

const observed = (value?: number) => value != null && Number.isFinite(value) ? { observedAt: new Date(value).toISOString() } : {}
const calculationNames = { difference: '누적 공시 차액', sum: '최근 4개 분기 합계', ocf_minus_capex: '영업현금흐름 − Capex' }
export function newsEvidence(article: { title: string; article_url: string; publisher: string; published_utc: string }, stale = false): EvidenceSource {
  return { kind: 'news', title: article.title, url: article.article_url, publisher: article.publisher, publishedAt: article.published_utc, stale, facts: [], links: [], caveat: '기사 제목·출처·발행일을 연결했습니다. 기사 본문은 저장하지 않습니다.' }
}
export function financialEvidence(row: FinancialPeriod, symbol: string, fetchedAt?: number, stale = false): EvidenceSource {
  const facts: EvidenceSource['facts'] = [{ label: '회계기준', value: row.accounting_standard }, { label: '공시 구분', value: `${row.fiscal_period}${row.amended ? ' · 수정 공시' : ''}${row.calculated ? ' · 계산 포함' : ''}` }]
  const links = new Map<string, EvidenceSource['links'][number]>()
  const metrics = [...financialMetrics, {key:'net_income_loss',label:'순이익',statement:'income_statement'}, {key:'diluted_earnings_per_share',label:'희석 EPS',statement:'income_statement'}] as const
  for (const metric of metrics) {
    const value = row.financials[metric.statement]?.[metric.key]
    if (!value || !Number.isFinite(value.value)) continue
    facts.push({ label: metric.label, value: `${value.value} ${value.unit}${value.basis ? ` · ${financialBasis(value.basis)}` : ''}${value.calculation ? ` · ${calculationNames[value.calculation]}` : ''}` })
    for (const s of value.sources ?? []) links.set(`${s.url}|${s.tag}|${s.start_date}|${s.end_date}`, { label: `${s.form} ${s.start_date ?? ''}~${s.end_date} · ${s.tag}: ${s.value} ${s.unit}${s.revised ? ' · 비교값 변경' : ''}`.slice(0, 300), url: s.url })
  }
  const sourceLinks = [...links.values()]
  return { kind: 'filing', title: `${symbol} · ${row.fiscal_period} 재무 공시 · ${row.end_date}`, publisher: 'SEC EDGAR', url: row.source_filing_url || sourceLinks[0]?.url || '', publishedAt: row.filing_date,
    period: `${row.start_date} ~ ${row.end_date}`, ...observed(fetchedAt), stale, facts, links: sourceLinks.slice(0, 30),
    caveat: '연결 당시의 공시값·계산값입니다. FCF는 영업현금흐름 − Capex이며 회사 조정 FCF와 다를 수 있습니다. 분기·TTM에는 누적 공시 차액·합산이 포함될 수 있고 이후 수정 공시·주식분할을 자동 반영하지 않습니다.' }
}
export function briefingEvidence(item: Briefing, stock?: NonNullable<Briefing['homepage']>['stocks'][number]): EvidenceSource {
  const referenced = stock ? stock.sourceIds : [...item.summary.slice(0,3).join(' ').matchAll(/\[(\d+)\]/g)].map(match=>Number(match[1]))
  const sources = referenced.length ? item.sources.filter(s => referenced.includes(s.id)) : item.sources
  const facts: EvidenceSource['facts'] = [{ label: '정보 기준 시각', value: item.cutoffAt }, ...(item.sessionDate ? [{ label: '미국 거래일', value: item.sessionDate }] : [])]
  if (stock) facts.push({ label: `${stock.name} (${stock.ticker})`, value: stock.change }, { label: '관측 기준', value: stock.basis }, { label: '당시 해석', value: stock.reason.slice(0, 1000) })
  else item.summary.slice(0, 3).forEach((value, i) => facts.push({ label: `요약 ${i + 1}`, value: value.slice(0, 1000) }))
  const corrections = (item.corrections ?? []).map(c => `${c.at}: ${c.text}`).join(' · ')
  return { kind: 'briefing', title: `${item.title}${stock ? ` · ${stock.ticker}` : ''}`, url: `https://yechanlee.vercel.app/briefings/${item.id}`, publisher: 'Anthracite', publishedAt: item.publishedAt,
    period: item.sessionDate || item.id, observedAt: item.cutoffAt, stale: false, facts,
    links: sources.slice(0, 30).map(s => ({ label: `${s.label}${s.accessNote?` · ${s.accessNote}`:''}`.slice(0, 300), url: s.url })), caveat: `브리핑에 기재된 요약·해석과 출처입니다. 원문 확인이 필요합니다. ${item.dataNote}${corrections ? ` 연결 당시 정정 이력: ${corrections}` : ''}`.slice(0, 2500) }
}
export function holdingEvidence(filing: FilingData, h: Holding, cik: string): EvidenceSource {
  const currentSources = (filing.sources || []).map(s => ({ label: `${s.form} · ${s.accession}`, url: s.indexUrl }))
  const previousSources = (filing.previousSources || []).map(s => ({ label: `전 분기 ${s.accession}`, url: s.indexUrl }))
  return { kind: '13f', title: `${h.name} · ${filing.period} 13F`, publisher: `SEC EDGAR · CIK ${cik}`, url: currentSources[0]?.url || '', publishedAt: filing.filedAt,
    period: filing.period, ...observed(filing.checkedAt), stale: !!filing.stale,
    facts: [{ label: 'CUSIP', value: h.cusip }, { label: '주식 클래스', value: h.title }, { label: '기관 CIK', value: cik }, { label: '수량', value: String(h.shares) },
      { label: '평가액 (USD)', value: String(h.value) }, { label: '비중 (%)', value: String(filing.totalValue ? h.value / filing.totalValue * 100 : 0) }, { label: '기관 수집 보유금액 (USD)', value: String(filing.totalValue) },
      { label: '전 분기 수량', value: h.prevShares === undefined ? '비교 자료 없음' : String(h.prevShares) }, { label: '전 분기 기준일', value: filing.previousPeriod }],
    links: [...currentSources, ...previousSources].slice(0, 30), caveat: '옵션 제외 SH 공개 공시 기준이며 전체 AUM이 아닙니다. 수량 차이가 실제 매매를 뜻하지 않습니다. CUSIP을 티커로 자동 변환하지 않으므로 연결할 종목을 직접 확인하세요.' }
}

export function comparisonEvidence(left: FilingData, right: FilingData, row: { cusip: string; name: string; title: string; left: Holding | null; right: Holding | null; difference: number }, a: {cik:string;firm:string}, b: {cik:string;firm:string}): EvidenceSource {
  if (left.period !== right.period) throw new Error('서로 다른 보고 분기의 자료는 연결할 수 없습니다.')
  const facts: EvidenceSource['facts'] = [{ label: 'CUSIP', value: row.cusip }, { label: '주식 클래스', value: row.title }, { label: '비중 차이 A−B (%p)', value: String(row.difference) }]
  for (const [key, manager, filing, holding] of [['A',a,left,row.left],['B',b,right,row.right]] as const) {
    facts.push({label:`${key} 기관`,value:`${manager.firm} · CIK ${manager.cik}`}, {label:`${key} 클래스`,value:holding?.title??'표시 대상 SH 미기재'}, {label:`${key} 수량`,value:holding?String(holding.shares):'표시 대상 SH 미기재'}, {label:`${key} 평가액 (USD)`,value:holding?String(holding.value):'표시 대상 SH 미기재'},
      {label:`${key} 비중 (%)`,value:holding?String(filing.totalValue?holding.value/filing.totalValue*100:0):'표시 대상 SH 미기재'}, {label:`${key} 수집 보유금액 (USD)`,value:String(filing.totalValue)}, {label:`${key} 제출일`,value:filing.filedAt??'미확인'}, {label:`${key} 자료 조회`,value:filing.checkedAt?new Date(filing.checkedAt).toISOString():'미확인'})
  }
  const links = [...(left.sources||[]).map(s=>({label:`A ${s.form} · ${s.accession}`,url:s.indexUrl})),...(right.sources||[]).map(s=>({label:`B ${s.form} · ${s.accession}`,url:s.indexUrl}))]
  return {kind:'13f',title:`${row.name} · ${left.period} 기관 비교`,url:links[0]?.url||'',publisher:'SEC EDGAR · 기관 간 비교',period:left.period,stale:!!left.stale||!!right.stale,facts,links:links.slice(0,30),caveat:'같은 보고 분기의 옵션 제외 SH 항목만 비교합니다. 비중은 각 기관 수집 보유금액을 분모로 사용합니다. 미기재는 표시 대상 SH 항목에 없다는 뜻이며 CUSIP과 연결할 종목을 직접 확인하세요.'}
}
