export interface ReturnOrigin { href: string; key: string; index: number | null }
interface LocationLike { pathname: string; search: string; hash: string; key: string; state?: unknown }
const labels: Record<string, string> = { '/': '뉴스 목록', '/markets': '시장', '/saved': '관심목록', '/briefings': '브리핑 목록', '/calendar': '캘린더', '/equity': '주식시장', '/rates': '금리·채권', '/fed': '연준·통화정책', '/indicators': '경제지표', '/macro': '글로벌 매크로', '/more': '더보기', '/live': '라이브', '/form13f': '13F', '/simulator': '시뮬레이터' }
export function originLabel(href: string) {
  const path = href.split(/[?#]/)[0]
  return labels[path] ?? (/^\/briefings\/[a-z0-9-]+$/.test(path) ? '브리핑' : /^\/saved\/thesis\/[A-Z0-9.-]+$/.test(path) ? '투자 노트' : null)
}
export function readReturnOrigin(state: unknown): ReturnOrigin | null {
  const candidate = (state as { returnOrigin?: ReturnOrigin } | null)?.returnOrigin
  if (!candidate || typeof candidate.href !== 'string' || candidate.href.length > 2500
    || !candidate.href.startsWith('/') || candidate.href.startsWith('//') || candidate.href.includes('\\') || [...candidate.href].some(char => char.charCodeAt(0) < 32)
    || !originLabel(candidate.href) || typeof candidate.key !== 'string' || candidate.key.length > 100
    || !(candidate.index === null || (Number.isSafeInteger(candidate.index) && candidate.index >= 0))) return null
  return candidate
}
export function makeReturnOrigin(location: LocationLike, index: unknown): ReturnOrigin | null {
  if (location.pathname.startsWith('/stock/')) return readReturnOrigin(location.state)
  const href = location.pathname + location.search + location.hash
  return originLabel(href) ? { href, key: location.key, index: typeof index === 'number' && Number.isSafeInteger(index) && index >= 0 ? index : null } : null
}
export function returnDelta(origin: ReturnOrigin | null, index: unknown) {
  return origin?.index !== null && origin?.index !== undefined && typeof index === 'number' && Number.isSafeInteger(index) && index > origin.index && index - origin.index <= 100 ? origin.index - index : null
}
