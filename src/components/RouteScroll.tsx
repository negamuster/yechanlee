import { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { createReadingStore, findReadingTarget, maintainReadingPosition, readingKeys } from '../lib/readingPosition'
import type { ReadingPosition } from '../lib/readingPosition'
let store: ReturnType<typeof createReadingStore> | undefined

function capture(): ReadingPosition {
  const header = document.querySelector('.site-header')?.getBoundingClientRect()
  const top = header && header.top <= 0 ? header.bottom + 8 : 8
  const anchor = [...document.querySelectorAll<HTMLElement>('[data-reading-key]')].find(element => {
    const rect = element.getBoundingClientRect()
    return rect.bottom > top && rect.top < window.innerHeight
  })
  const focused = document.activeElement?.closest<HTMLElement>('[data-focus-key]')?.dataset.focusKey
  return {
    y: Math.max(0, window.scrollY),
    ...(anchor ? { anchor: { key: anchor.dataset.readingKey!, offset: anchor.getBoundingClientRect().top } } : {}),
    ...(focused ? { focus: focused } : {}),
    panels: Object.fromEntries([...document.querySelectorAll<HTMLElement>('[data-scroll-key]')].map(element => [element.dataset.scrollKey!, { top: Math.max(0, element.scrollTop), left: Math.max(0, element.scrollLeft) }])),
  }
}
function restore(position: ReadingPosition) {
  for (const element of document.querySelectorAll<HTMLElement>('[data-scroll-key]')) {
    const point = position.panels[element.dataset.scrollKey!]
    if (point) { element.scrollTop = point.top; element.scrollLeft = point.left }
  }
  const anchor = position.anchor && [...document.querySelectorAll<HTMLElement>('[data-reading-key]')].find(element => element.dataset.readingKey === position.anchor!.key)
  const y = anchor ? window.scrollY + anchor.getBoundingClientRect().top - position.anchor!.offset : position.y
  if (Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: Math.max(0, y), behavior: 'instant' })
  if (position.focus && document.activeElement === document.body) {
    const link = [...document.querySelectorAll<HTMLElement>('[data-focus-key]')].find(element => element.dataset.focusKey === position.focus)
    link?.focus({ preventScroll: true })
  }
}
export default function RouteScroll() {
  const location = useLocation()
  const navigation = useNavigationType()
  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => { window.history.scrollRestoration = previous }
  }, [])
  useLayoutEffect(() => {
    store ??= createReadingStore({ getItem: key => sessionStorage.getItem(key), setItem: (key, value) => sessionStorage.setItem(key, value) })
    const layout = window.matchMedia('(max-width: 700px)').matches ? 'mobile' : 'desktop'
    const keys = readingKeys(layout, location.key, location.pathname + location.search)
    const target = findReadingTarget(store, layout, location, navigation)
    return maintainReadingPosition(target.position, target.hash, {
      capture, restore,
      followHash(hash) {
        let id: string
        try { id = decodeURIComponent(hash.slice(1)) } catch { return false }
        const target = document.getElementById(id)
        if (!target) return false
        target.scrollIntoView({ block: 'start', behavior: 'instant' })
        return true
      },
      observe(callback) {
        const root = document.getElementById('root')!
        let frame = 0
        const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(callback) }
        const resize = new ResizeObserver(update)
        const mutation = new MutationObserver(update)
        resize.observe(root); mutation.observe(root, { childList: true, subtree: true })
        document.addEventListener('load', update, true)
        return () => { resize.disconnect(); mutation.disconnect(); cancelAnimationFrame(frame); document.removeEventListener('load', update, true) }
      },
      onScroll(callback) {
        let frame = 0
        const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(callback) }
        document.addEventListener('scroll', update, true)
        document.addEventListener('click', callback, true)
        return () => { document.removeEventListener('scroll', update, true); document.removeEventListener('click', callback, true); cancelAnimationFrame(frame) }
      },
      onInteraction(callback) {
        const events = ['pointerdown', 'touchstart', 'wheel', 'keydown'] as const
        events.forEach(event => document.addEventListener(event, callback, { capture: true, passive: true }))
        return () => events.forEach(event => document.removeEventListener(event, callback, true))
      },
      onExit(callback) { window.addEventListener('pagehide', callback); return () => window.removeEventListener('pagehide', callback) },
      deadline(callback, milliseconds) { const timer = window.setTimeout(callback, milliseconds); return () => window.clearTimeout(timer) },
    }, position => { store!.set(keys.entry, position); store!.set(keys.route, position) })
  }, [location.key, location.pathname, location.search, location.hash, location.state, navigation])
  return null
}
