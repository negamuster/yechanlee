import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { classifyNews } from './news-topics.js'

// Publisher feeds only. Images come from feed metadata; article bodies are never scraped.
export const SOURCES = [
  { id: 'bbc-business', publisher: 'BBC Business', region: 'global', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', hosts: ['bbc.com', 'bbc.co.uk'], imageHosts: ['ichef.bbci.co.uk'] },
  { id: 'wsj-markets', publisher: 'WSJ', region: 'global', url: 'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain', hosts: ['wsj.com'], imageHosts: ['images.wsj.net', 's.wsj.net'] },
  { id: 'wsj-business', publisher: 'WSJ', region: 'global', url: 'https://feeds.content.dowjones.io/public/rss/WSJcomUSBusiness', hosts: ['wsj.com'], imageHosts: ['images.wsj.net', 's.wsj.net'] },
  { id: 'cnbc-finance', publisher: 'CNBC', region: 'global', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html', hosts: ['cnbc.com'], imageHosts: ['image.cnbcfm.com'] },
  { id: 'bloomberg-markets', publisher: 'Bloomberg', region: 'global', url: 'https://www.bloomberg.com/feeds/markets/news.rss', hosts: ['bloomberg.com'], imageHosts: ['assets.bwbx.io'] },
  { id: 'ft-markets', publisher: 'Financial Times', region: 'global', url: 'https://www.ft.com/rss/markets', hosts: ['ft.com'], imageHosts: ['images.ft.com', 'im.ft-static.com', 'd1e00ek4ebabms.cloudfront.net'] },
  { id: 'yahoo-finance', publisher: 'Yahoo Finance', region: 'global', url: 'https://finance.yahoo.com/news/rssindex', hosts: ['finance.yahoo.com'], imageHosts: ['s.yimg.com', 'media.zenfs.com'] },
  { id: 'reuters', publisher: 'Reuters', region: 'global', env: 'REUTERS_RSS_URL', hosts: ['reuters.com', 'reutersconnect.com'], feedHosts: ['reuters.com', 'reutersconnect.com', 'thomsonreuters.com'], imageHosts: ['static.reuters.com', 'cloudfront-us-east-2.images.arcpublishing.com'] },
  { id: 'mk-economy', publisher: '매일경제', region: 'kr', url: 'https://www.mk.co.kr/rss/30100041/', hosts: ['mk.co.kr'], imageHosts: ['file.mk.co.kr', 'pimg.mk.co.kr'] },
  { id: 'mk-stocks', publisher: '매일경제', region: 'kr', url: 'https://www.mk.co.kr/rss/50200011/', hosts: ['mk.co.kr'], imageHosts: ['file.mk.co.kr', 'pimg.mk.co.kr'] },
  { id: 'chosunbiz', publisher: '조선비즈', region: 'kr', url: 'https://biz.chosun.com/arc/outboundfeeds/rss/?outputType=xml', hosts: ['biz.chosun.com'], imageHosts: ['images.chosun.com'] },
  { id: 'hankyung-economy', publisher: '한국경제', region: 'kr', url: 'https://www.hankyung.com/feed/economy', hosts: ['hankyung.com'], imageHosts: ['img.hankyung.com'] },
  { id: 'yonhap-economy', publisher: '연합뉴스', region: 'kr', url: 'https://www.yna.co.kr/rss/economy.xml', hosts: ['yna.co.kr'], imageHosts: ['img.yna.co.kr'] },
  { id: 'infomax', publisher: '연합인포맥스', region: 'kr', url: 'https://news.einfomax.co.kr/rss/allArticle.xml', hosts: ['einfomax.co.kr', 'einfomax.com'], imageHosts: ['cdn.einfomax.co.kr'], timezone: '+09:00' },
]

export const MAX_AGE = 72 * 60 * 60 * 1000
const MAX_BYTES = 2 * 1024 * 1024
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true })
const array = value => value == null ? [] : Array.isArray(value) ? value : [value]
const text = value => typeof value === 'string' ? value : typeof value?.['#text'] === 'string' ? value['#text'] : ''

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

export function publicationTime(value, source) {
  // A timezone-less Korean feed date must not be interpreted in the server's timezone.
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    return source.timezone ? Date.parse(value.replace(' ', 'T') + source.timezone) : NaN
  }
  return Date.parse(value)
}

function safeImageUrl(value, source) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    if (![...source.hosts, ...(source.imageHosts || [])].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return null
    if (/\.svg(?:$|\?)/i.test(url.pathname) || /(?:^|[\/_-])(logo|pixel|tracker|favicon)(?:[\/_\-.]|$)/i.test(url.pathname)) return null
    return url.href // Preserve image resize/signature parameters exactly.
  } catch { return null }
}

export function feedImage(entry, source) {
  const groups = [entry, ...array(entry['media:group'])]
  const candidates = groups.flatMap(group => [
    ...array(group['media:content']).filter(item => item?.['@_medium'] === 'image' || item?.['@_type']?.startsWith('image/') || (!item?.['@_medium'] && !item?.['@_type'])),
    ...array(group['media:thumbnail']),
    ...array(group.enclosure).filter(item => item?.['@_type']?.startsWith('image/')),
  ].map(item => ({ ...item, 'media:credit': item?.['media:credit'] ?? group['media:credit'] ?? group['media:copyright'] })))
  // Some RSS providers place an <img> in their feed description. Only extract
  // its attributes; never render that HTML or fetch the original article page.
  for (const match of text(entry.description).matchAll(/<img\b[^>]*\s+src\s*=\s*(["'])(.*?)\1[^>]*>/gi)) {
    const attrs = match[0]
    const url = match[2].replace(/&amp;/g, '&')
    candidates.push({ '@_url': url, '@_width': attrs.match(/\bwidth\s*=\s*["']?(\d+)/i)?.[1], '@_height': attrs.match(/\bheight\s*=\s*["']?(\d+)/i)?.[1] })
  }
  candidates.sort((a, b) => Number(b?.['@_width'] || 0) - Number(a?.['@_width'] || 0))
  for (const candidate of candidates) {
    const width = Number(candidate?.['@_width'])
    const height = Number(candidate?.['@_height'])
    if ((width > 0 && width < 160) || (height > 0 && height < 90)) continue
    const url = safeImageUrl(candidate?.['@_url'], source)
    if (!url) continue
    const credit = text(candidate?.['media:credit']) || text(entry['media:credit']) || text(entry['media:copyright'])
    return { image_url: url, ...(credit ? { image_credit: credit.replace(/<[^>]*>/g, '').slice(0, 200) } : {}) }
  }
  return {}
}

export function parseFeed(xml, source, now = Date.now()) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error('Invalid feed')
  const parsed = parser.parse(xml)
  if (!parsed.rss?.channel && !parsed.feed) throw new Error('Unsupported feed')
  const entries = array(parsed.rss?.channel?.item ?? parsed.feed?.entry)
  return entries.slice(0, 150).flatMap(entry => {
    const title = text(entry.title).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    const categories = array(entry.category).map(c => text(c) || c?.['@_term'] || '').join(' ')
    if (!title || title.length > 500) return []
    const topics = classifyNews(title, categories)
    if (!topics.length) return []
    const atomLink = array(entry.link).find(link => link?.['@_href'] && (!link['@_rel'] || link['@_rel'] === 'alternate'))
    const url = safeArticleUrl(text(entry.link) || atomLink?.['@_href'], source.hosts)
    const timestamp = publicationTime(text(entry.pubDate) || text(entry.published) || text(entry.updated), source)
    if (!url || !Number.isFinite(timestamp) || timestamp > now + 5 * 60 * 1000 || now - timestamp > MAX_AGE) return []
    return [{ id: url, title, topics, article_url: url, published_utc: new Date(timestamp).toISOString(), publisher: source.publisher, region: source.region, ...feedImage(entry, source) }]
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

function feedError(code) {
  const error = new Error(code)
  error.code = code
  return error
}

async function fetchFeed(source, fetcher, signal) {
  let target = new URL(source.url)
  const feedHost = target.hostname
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetcher(target.href, {
      signal, redirect: 'manual',
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
        'User-Agent': 'Anthracite/1.0 (+https://yechanlee.vercel.app)',
      },
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (response.body) await response.body.cancel()
      if (!location) throw feedError('invalid_redirect')
      const next = new URL(location, target)
      const hosts = [feedHost, ...source.hosts]
      if (next.protocol !== 'https:' || !safeArticleUrl(next.href, hosts)) throw feedError('redirect_not_allowed')
      target = next
      continue
    }
    if (!response.ok) {
      if (response.body) await response.body.cancel()
      throw feedError(`http_${response.status}`)
    }
    return response
  }
  throw feedError('too_many_redirects')
}

export async function collectNews(fetcher = fetch, sources = SOURCES, now = Date.now(), timeoutMs = 10000) {
  const results = await Promise.all(sources.map(async configured => {
    let source = configured
    if (source.env) {
      const url = process.env[source.env]
      if (!url) return { source, items: [], status: 'not_configured' }
      if (!url.startsWith('https://') || !safeArticleUrl(url, source.feedHosts || source.hosts)) {
        return { source, items: [], status: 'unavailable', error: 'invalid_configuration' }
      }
      source = { ...source, url }
    }
    const controller = new AbortController()
    let timer
    let stage = 'request'
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(feedError('timeout')) }, timeoutMs)
      })
      const work = (async () => {
        const response = await fetchFeed(source, fetcher, controller.signal)
        stage = 'read'
        const xml = await readLimited(response)
        stage = 'parse'
        return parseFeed(xml, source, now)
      })()
      const items = await Promise.race([work, timeout])
      return { source, items, status: items.length ? 'ok' : 'empty' }
    } catch (error) {
      const code = controller.signal.aborted ? 'timeout'
        : error?.code && /^(http_\d{3}|invalid_redirect|redirect_not_allowed|too_many_redirects)$/.test(error.code)
          ? error.code : `${stage}_failed`
      return { source, items: [], status: 'unavailable', error: code }
    } finally { clearTimeout(timer) }
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
    version: 'rss-node-v5', items: bounded, fetchedAt: now,
    sources: results.map(({ source, status, error }) => ({ id: source.id, publisher: source.publisher, region: source.region, status, ...(error ? { error } : {}) })),
  }
}
