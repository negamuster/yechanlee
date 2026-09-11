import { XMLParser, XMLValidator } from 'fast-xml-parser'

// Publisher-owned feeds only. No article scraping, images, or full-text redistribution.
export const SOURCES = [
  { id: 'bbc-business', publisher: 'BBC Business', region: 'global', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', hosts: ['bbc.com', 'bbc.co.uk'] },
  { id: 'wsj-markets', publisher: 'WSJ', region: 'global', url: 'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain', hosts: ['wsj.com'] },
  { id: 'wsj-business', publisher: 'WSJ', region: 'global', url: 'https://feeds.content.dowjones.io/public/rss/WSJcomUSBusiness', hosts: ['wsj.com'] },
  { id: 'cnbc-finance', publisher: 'CNBC', region: 'global', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html', hosts: ['cnbc.com'] },
  { id: 'mk-economy', publisher: '매일경제', region: 'kr', url: 'https://www.mk.co.kr/rss/30100041/', hosts: ['mk.co.kr'] },
  { id: 'mk-stocks', publisher: '매일경제', region: 'kr', url: 'https://www.mk.co.kr/rss/50200011/', hosts: ['mk.co.kr'] },
  { id: 'chosunbiz', publisher: '조선비즈', region: 'kr', url: 'https://biz.chosun.com/arc/outboundfeeds/rss/?outputType=xml', hosts: ['biz.chosun.com'], filterTopics: true },
]

export const MAX_AGE = 72 * 60 * 60 * 1000
const MAX_BYTES = 2 * 1024 * 1024
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true })
const array = value => value == null ? [] : Array.isArray(value) ? value : [value]
const text = value => typeof value === 'string' ? value : typeof value?.['#text'] === 'string' ? value['#text'] : ''
const PROMOTIONAL = /\b(?:globenewswire|pr newswire|business wire|sponsored|advertorial|class action|shareholder alert|lead plaintiff|market research report|cagr)\b|보도자료|협찬|광고성|\[광고\]|\[홍보\]/i
const FINANCE = /경제|금융|증권|주식|증시|코스피|코스닥|금리|환율|물가|채권|기업|산업|실적|매출|영업이익|반도체|부동산|투자|은행|연준|관세|수출|수입|무역|원유|유가|에너지|인수|합병|테크|테크놀로지|자동차|배터리|AI|인공지능|스타트업|유통|보험|연금|거시|정책|코인|가상자산/i

export function safeArticleUrl(value, hosts) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null
    if (!hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return null
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|mod$|reflink$|rss$|outputType$)/i.test(key)) url.searchParams.delete(key)
    }
    return url.href
  } catch { return null }
}

export function parseFeed(xml, source, now = Date.now()) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid feed')
  const parsed = parser.parse(xml)
  if (!parsed.rss?.channel && !parsed.feed) throw new Error('Unsupported feed')
  const entries = array(parsed.rss?.channel?.item ?? parsed.feed?.entry)
  return entries.slice(0, 150).flatMap(entry => {
    const title = text(entry.title).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    const categories = array(entry.category).map(c => text(c) || c?.['@_term'] || '').join(' ')
    if (!title || title.length > 500 || PROMOTIONAL.test(`${title} ${categories}`)) return []
    if (source.filterTopics && !FINANCE.test(`${title} ${categories}`)) return []
    const atomLink = array(entry.link).find(link => link?.['@_href'] && (!link['@_rel'] || link['@_rel'] === 'alternate'))
    const url = safeArticleUrl(text(entry.link) || atomLink?.['@_href'], source.hosts)
    const timestamp = Date.parse(text(entry.pubDate) || text(entry.published) || text(entry.updated))
    if (!url || !Number.isFinite(timestamp) || timestamp > now + 5 * 60 * 1000 || now - timestamp > MAX_AGE) return []
    return [{ id: url, title, article_url: url, published_utc: new Date(timestamp).toISOString(), publisher: source.publisher, region: source.region }]
  })
}

async function readLimited(response) {
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Feed too large')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Empty feed')
  const decoder = new TextDecoder()
  let size = 0
  let output = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) throw new Error('Feed too large')
      output += decoder.decode(value, { stream: true })
    }
    return output + decoder.decode()
  } finally { await reader.cancel().catch(() => {}) }
}

export async function collectNews(fetcher = fetch, sources = SOURCES, now = Date.now()) {
  const results = await Promise.all(sources.map(async source => {
    try {
      const response = await fetcher(source.url, {
        signal: AbortSignal.timeout(12000), redirect: 'error',
        headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
      })
      if (!response.ok) throw new Error(`Feed HTTP ${response.status}`)
      const items = parseFeed(await readLimited(response), source, now)
      return { source, items, status: items.length ? 'ok' : 'empty' }
    } catch { return { source, items: [], status: 'unavailable' } }
  }))
  const seenUrls = new Set()
  const seenTitles = new Set()
  const items = results.flatMap(result => result.items)
    .sort((a, b) => Date.parse(b.published_utc) - Date.parse(a.published_utc))
    .filter(item => {
      const key = item.title.toLocaleLowerCase().replace(/[\p{P}\p{S}\s]/gu, '')
      if (seenUrls.has(item.article_url) || seenTitles.has(key)) return false
      seenUrls.add(item.article_url); seenTitles.add(key)
      return true
    })
  // Keep each publisher/region represented in the payload even with a prolific feed.
  const counts = new Map()
  const bounded = items.filter(item => {
    const count = counts.get(item.publisher) || 0
    counts.set(item.publisher, count + 1)
    return count < 24
  })
  return {
    items: bounded, fetchedAt: now,
    sources: results.map(({ source, status }) => ({ id: source.id, publisher: source.publisher, region: source.region, status })),
  }
}
