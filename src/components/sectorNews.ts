export type NewsSector = { symbol: string; name: string }
// Conservative title keywords, not a claim about the cause of sector returns.
const keywords: Record<string, RegExp> = {
  XLK: /\b(technology|software|semiconductors?|chips?|artificial intelligence|AI|Nvidia|Microsoft|Apple|Intel|AMD|TSMC)\b|반도체|인공지능|소프트웨어|엔비디아|마이크로소프트/i,
  XLC: /\b(telecom|telecommunications|streaming|advertising|Alphabet|Google|Meta|Netflix|Disney|Comcast)\b|통신|스트리밍|광고|구글|넷플릭스/i,
  XLY: /\b(retail|retailers?|automakers?|automotive|Amazon|Tesla|Nike|McDonald'?s|Starbucks|Home Depot)\b|소매|자동차|아마존|테슬라|스타벅스/i,
  XLP: /\b(consumer staples|grocer(?:y|ies)|supermarkets?|Walmart|Costco|Coca-Cola|PepsiCo|Procter|tobacco)\b|필수소비재|식료품|월마트|코스트코|담배/i,
  XLE: /\b(crude|oil|natural gas|petroleum|OPEC|Exxon|Chevron|refiner(?:y|ies))\b|원유|석유|천연가스|정유/i,
  XLF: /\b(banks?|banking|insurers?|insurance|JPMorgan|Goldman Sachs|Morgan Stanley|Berkshire|Visa|Mastercard)\b|은행|보험|금융주|증권사/i,
  XLV: /\b(healthcare|health care|pharma(?:ceutical)?|biotech|hospitals?|Pfizer|Eli Lilly|Merck|UnitedHealth|drugmakers?)\b|헬스케어|제약|바이오|의료|신약/i,
  XLI: /\b(industrials?|aerospace|airlines?|Boeing|Caterpillar|Lockheed|Honeywell|manufacturing|freight)\b|산업재|항공|방산|제조업|물류/i,
  XLB: /\b(materials|chemicals?|mining|miners?|steel|copper|aluminum|aluminium|lithium|Dow Inc|DuPont)\b|소재|화학|광산|철강|구리|알루미늄|리튬/i,
  XLRE: /\b(real estate|REITs?|commercial property|Prologis|American Tower)\b|부동산|리츠|상업용 건물/i,
  XLU: /\b(utilities|electric utility|power grid|electricity|NextEra|Duke Energy|Southern Company)\b|유틸리티|전력망|전력회사|전기요금/i,
}
export function matchesSector(title: string, symbol: string | null) {
  return symbol === null || (keywords[symbol]?.test(title.normalize('NFKC')) ?? false)
}
