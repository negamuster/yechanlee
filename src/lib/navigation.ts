export const marketLinks = [
  { to: '/equity', label: '주식시장' },
  { to: '/rates', label: '금리·채권' },
  { to: '/fed', label: '연준·통화정책' },
  { to: '/indicators', label: '경제지표' },
  { to: '/macro', label: '글로벌 매크로' },
]
export const toolLinks = [
  { to: '/calendar', label: '경제·실적 캘린더' },
  { to: '/filings', label: 'SEC 공시 모니터' },
  { to: '/form13f', label: '기관 포트폴리오 · 13F' },
  { to: '/simulator', label: '자산 시뮬레이터' },
]
export const desktopLinks = [{ to: '/', label: '홈' }, ...marketLinks, ...toolLinks, { to: '/saved', label: '저장한 항목' }]

// Detail screens retain their parent destination without selecting multiple links.
export function desktopSection(pathname: string) {
  if (pathname === '/briefings' || pathname.startsWith('/briefings/')) return '/'
  if (pathname.startsWith('/stock/')) return '/equity'
  if (pathname.startsWith('/saved/')) return '/saved'
  return desktopLinks.some(link => link.to === pathname) ? pathname : null
}
