import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function RouteScroll() {
  const { pathname, search } = useLocation()
  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => { window.history.scrollRestoration = previous }
  }, [])
  useLayoutEffect(() => {
    const key = `anthracite.scroll.v1.${window.matchMedia('(max-width: 700px)').matches ? 'mobile' : 'desktop'}:${pathname}${search}`
    let target = 0
    try { target = Math.max(0, Number(sessionStorage.getItem(key)) || 0) } catch { /* Optional storage. */ }
    let restoring = true
    let lastY = target
    const save = () => { try { sessionStorage.setItem(key, String(lastY)) } catch { /* Optional storage. */ } }
    const record = () => { if (!restoring) lastY = window.scrollY }
    const restore = () => { if (restoring) window.scrollTo({ top: target, behavior: 'instant' }) }
    const stop = () => { restoring = false; lastY = window.scrollY }
    restore()
    const observer = new ResizeObserver(restore)
    observer.observe(document.getElementById('root')!)
    const timer = window.setTimeout(stop, 5000)
    window.addEventListener('scroll', record, { passive: true })
    window.addEventListener('pagehide', save)
    const events = ['pointerdown', 'touchstart', 'wheel', 'keydown'] as const
    events.forEach(event => window.addEventListener(event, stop, { passive: true }))
    return () => {
      save(); observer.disconnect(); clearTimeout(timer)
      window.removeEventListener('scroll', record)
      window.removeEventListener('pagehide', save)
      events.forEach(event => window.removeEventListener(event, stop))
    }
  }, [pathname, search])
  return null
}
