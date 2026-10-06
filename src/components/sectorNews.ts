export type NewsSector = { symbol: string; name: string }
// Conservative title keywords, not a claim about the cause of sector returns.
const keywords: Record<string, RegExp> = {
  XLK: /\b(tech|technology|software|semiconductors?|chips?|artificial intelligence|AI|OpenAI|Anthropic|Broadcom|cybersecurity|data cent(?:er|re)s?|Nvidia|Microsoft|Apple|Intel|AMD|TSMC|HP|Hewlett.Packard)\b|반도체|인공지능|소프트웨어|엔비디아|마이크로소프트|오픈AI|브로드컴|데이터센터|삼성전자|SK하이닉스|보안주|보안株|보안 관련주|안랩/i,
  XLC: /\b(telecom|telecommunications|streaming|advertising|media|Alphabet|Google|Meta|Netflix|Disney|Comcast|Skydance)\b|통신|스트리밍|광고|구글|넷플릭스|네이버|NAVER|카카오/i,
  XLY: /\b(retail|retailers?|automakers?|automotive|auto|electric vehicles?|Amazon|Tesla|Nike|McDonald'?s|Starbucks|Home Depot)\b|소매|자동차|아마존|테슬라|스타벅스|맥도날드|현대차|기아|이커머스|전자상거래/i,
  XLP: /\b(consumer staples|grocer(?:y|ies)|supermarkets?|Walmart|Costco|Coca-Cola|PepsiCo|Procter|tobacco|cosmetics|Estee Lauder)\b|필수소비재|식료품|월마트|코스트코|담배|식품|음료|화장품|롯데칠성|한국콜마|에스티 로더|홈플러스/i,
  XLE: /\b(crude|oil|natural gas|petroleum|diesel|OPEC|Exxon|Chevron|Aramco|TotalEnergies|refiner(?:y|ies))\b|원유|석유|천연가스|정유|아람코/i,
  XLF: /\b(banks?|banking|financial stocks?|financial services|hedge funds?|private equity|private.capital|asset manag(?:er|ement)|insurers?|insurance|KKR|BlackRock|JPMorgan|Goldman Sachs|Morgan Stanley|Berkshire|Visa|Mastercard)\b|은행|보험|금융주|증권사|금융권|금융기관|금융사|JB금융|블랙록|자산운용|헤지펀드|사모펀드/i,
  XLV: /\b(healthcare|health care|pharma(?:ceutical)?|biotech|hospitals?|Pfizer|Eli Lilly|Merck|UnitedHealth|drugmakers?)\b|헬스케어|제약|바이오|의료|신약|임상|치료제|HLB/i,
  XLI: /\b(industrials?|aerospace|airlines?|Boeing|Caterpillar|Lockheed|Honeywell|manufacturing|freight|robotics|truckers?|British Airways)\b|산업재|항공|방산|제조업|물류|로보틱스|로봇|조선|현대로템/i,
  XLB: /\b(materials|chemicals?|mining|miners?|steel|copper|gold|aluminum|aluminium|lithium|Dow Inc|DuPont)\b|첨단소재|신소재|소재주|케미칼|화학|광산|철강|구리|알루미늄|리튬|금값|금 가격/i,
  XLRE: /\b(real estate|REITs?|commercial property|Prologis|American Tower)\b|부동산|리츠|상업용 건물/i,
  XLU: /\b(utilities|electric utility|power grid|electricity|energy bills|NextEra|Duke Energy|Southern Company)\b|유틸리티|전력망|전력회사|전기요금|전력사업/i,
}
// Remove common non-sector senses before matching; retain other evidence in the title.
function normalizeTitle(title: string, symbol: string) {
  let text = title.normalize('NFKC').replace(/&(?:quot|apos|amp|#39|#x2019);/gi, ' ')
  if (symbol === 'XLK') text = text.replace(/\bblue[- ]chips?\b|\bchips? away\b|\b(?:potato|tortilla|poker|chocolate) chips?\b|\b(?:apple (?:pie|juice|cider|harvest)|big apple)\b|애플파이/gi, '')
  if (symbol === 'XLY' && /\b(Walmart|Costco|Kroger)\b|월마트|코스트코|홈플러스/i.test(text)) text = text.replace(/\bretail(?:ers?)?\b|소매/gi, '')
  if (symbol === 'XLE') text = text.replace(/\b(?:olive|cooking|vegetable|palm|coconut|sunflower) oil\b|식용유|올리브유/gi, '')
  if (symbol === 'XLF') {
    text = text.replace(/\b(?:central banks?|food banks?|river banks?|blood banks?|visa[- ]free|visa (?:rules?|applications?|requirements?|restrictions?|policy|policies)|(?:tourist|student|work|travel) visas?)\b|중앙은행|한국은행|일본은행|인민은행|유럽중앙은행/gi, '')
    // A broker quoting an analyst is not evidence that the article is about financial companies.
    text = text.replace(/^(?:[“"'‘]?[\w가-힣·]+증권)[, :]+(?=[“"'‘])/u, '')
  }
  return text
}
export function matchesSector(title: string, symbol: string | null) {
  return symbol === null || (keywords[symbol]?.test(normalizeTitle(title, symbol)) ?? false)
}
