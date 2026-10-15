export function mobileSection(pathname: string) {
  if (pathname === '/' || pathname === '/briefings' || pathname.startsWith('/briefings/')) return '/'
  if (pathname === '/saved' || pathname.startsWith('/saved/')) return '/saved'
  if (pathname === '/calendar') return '/calendar'
  if (['/markets', '/equity'].includes(pathname) || pathname.startsWith('/stock/')) return '/markets'
  return '/more'
}
interface KeyboardTarget { tagName: string; type?: string; readOnly?: boolean; disabled?: boolean; isContentEditable?: boolean }
export function isTextEntry(target: KeyboardTarget | null) {
  if (!target || target.readOnly || target.disabled) return false
  if (target.isContentEditable) return true
  const tag = target.tagName.toUpperCase()
  return tag === 'TEXTAREA' || tag === 'INPUT' && ['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(target.type || 'text')
}
export function hideMobileNavigation(editable: boolean, layoutHeight: number, viewport: { height: number; scale: number } | null) {
  if (!editable) return false
  if (!viewport) return true
  if (![layoutHeight, viewport.height, viewport.scale].every(value => Number.isFinite(value) && value > 0)) return false
  // Approximate keyboard occlusion; multiplying by scale excludes ordinary pinch zoom.
  return layoutHeight - viewport.height * viewport.scale > Math.min(120, layoutHeight * .2)
}
