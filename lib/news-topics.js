// Editorial rules for Anthracite, based only on headlines and RSS categories.
// These labels describe topics, not investment merit or predicted market impact.
const RULES = [
  ['economy', /경제|거시|금리|기준금리|중앙은행|연준|한국은행|물가|인플레이션|고용|실업|경기침체|국내총생산|관세|무역|수출|수입액|재정|국가부채|통화정책|환율|주택시장|주택가격|부동산|원유|유가|원자재|\b(?:econom(?:y|ic|ics|ies)|macro|inflation|deflation|interest rates?|central banks?|federal reserve|fed|ecb|boj|gdp|cpi|pce|payrolls?|unemployment|recession|tariffs?|trade war|exports?|imports?|fiscal|monetary|housing|mortgage|oil prices?|crude|commodit(?:y|ies))\b/i],
  ['tech', /반도체|인공지능|데이터센터|데이터 센터|파운드리|로봇|양자컴|클라우드|사이버보안|소프트웨어|테크|첨단기술|전기차|배터리|엔비디아|인텔|TSMC|SK하이닉스|삼성전자|\b(?:ai|artificial intelligence|tech(?:nology|nologies)?|semiconductors?|chips?|chipmakers?|foundr(?:y|ies)|data cent(?:er|re)s?|robot(?:s|ics)?|quantum|cloud|cybersecurity|software|nvidia|intel|tsmc|openai|anthropic|electric vehicles?|batter(?:y|ies))\b/i],
  ['investing', /증권|주식|증시|코스피|코스닥|나스닥|뉴욕증시|채권|국채|수익률|펀드|배당|자사주|공모주|공매도|자산운용|가상자산|암호화폐|비트코인|투자|\b(?:invest(?:ing|ment|ments|or|ors)?|stocks?|shares?|equities|equity|markets?|bonds?|treasur(?:y|ies)|yields?|etfs?|funds?|dividends?|buybacks?|portfolios?|wall street|nasdaq|s&p|dow jones|bitcoin|crypto(?:currency)?|ipo)\b/i],
  ['business', /기업|산업|실적|매출|영업이익|순이익|수주|공급망|인수합병|합병|상장|경영|구조조정|사업재편|설비투자|공장|생산량|스타트업|은행|금융|보험|유통업|항공사|자동차|신약|임상|\b(?:business|compan(?:y|ies)|corporat(?:e|ion|ions)|earnings|revenue|profits?|sales|acquisition|merger|takeover|ipo|ceo|cfo|layoffs?|supply chain|manufactur(?:ing|er|ers)|factor(?:y|ies)|startups?|banks?|banking|financ(?:e|ial)|insur(?:ance|er|ers)|airlines?|automakers?|drug trial|clinical trial)\b/i],
]
const EXTRA_RULES = {
  economy: /유류|석유|철강|원화|달러|엔화|전력|에너지|세제|세금|부양책|\b(?:oil|brent|wti|diesel|fuel|energy|electricity|natural gas|steel|fertilisers?|fertilizers?|exporters?|dollar|yen|yuan|tax(?:es)?|stimulus)\b/i,
  tech: /애플|마이크로소프트|구글|아마존|우주항공|위성|\b(?:apple|microsoft|alphabet|google|amazon|micron|spacex|satellites?|smartphones?)\b/i,
  investing: /미공개정보|불공정거래|시세조종|목표주가|퇴직연금|자금유입|\b(?:private (?:credit|debt|equity)|debt|401\(k\)|roth|ira|retirement|cd rates?|apy|rate hike|rate cut|insider trad(?:e|ing))\b/i,
  business: /인수|지분|영업|이익률|대출|유통|\b(?:retail|retailers?|executives?|majority stake|minority stake|take over|margins?|loans?|lending|medicines?|pharma(?:ceutical)?|biotech)\b/i,
}
// Lifestyle/celebrity/sports/incident stories should not pass just because a feed
// is categorised as "business", or because a headline contains "AI" or "market".
const OFF_TOPIC = /오늘의\s*(?:날씨|운세)|띠별\s*운세|별자리|결혼식|열애|이혼|남편|아내|예능|성추행|성폭행|살인|시신|음주운전|맛집|레시피|여행\s*추천|연예|아이돌|야구|축구|골프|\b(?:horoscope|weather forecast|recipe|celebrity|celebrities|wedding|divorce|murder|obituar(?:y|ies)|football|baseball|soccer|golf|beauty routine)\b/i
const BUSINESS_CONTEXT = /실적|매출|영업이익|순이익|수주|주가|증시|금리|물가|고용|상장|인수합병|중계권|관세|공급망|\b(?:earnings|revenue|profits?|stock price|shares?|merger|acquisition|broadcast rights|inflation|tariffs?|supply chain)\b/i
const PROMOTIONAL = /\b(?:globenewswire|pr newswire|business wire|sponsored|advertorial|class action|shareholder alert|lead plaintiff|market research report|cagr|promo code|coupon code|best deals?|shop now)\b|보도자료|협찬|광고성|\[광고\]|\[홍보\]|쿠폰코드|할인코드/i

export function classifyNews(title, categories = '') {
  const headline = String(title).normalize('NFKC')
  const metadata = String(categories).normalize('NFKC')
  if (PROMOTIONAL.test(`${headline} ${metadata}`)) return []
  if (OFF_TOPIC.test(headline) && !BUSINESS_CONTEXT.test(headline)) return []
  const direct = RULES.filter(([id, pattern]) => pattern.test(headline) || EXTRA_RULES[id].test(headline)).map(([id]) => id)
  // Headline matches take precedence: broad publisher categories do not attach
  // "economy" or "business" to every technology or investing story.
  return direct.length ? direct : RULES.filter(([, pattern]) => pattern.test(metadata)).map(([id]) => id)
}
