import { useEffect, useRef, useState } from 'react'
import { hideMobileNavigation, isTextEntry, mobileSection } from '../lib/mobileUI'
import { Link, useLocation } from 'react-router-dom'
import { Bookmark, CalendarDays, ChartNoAxesCombined, Menu, Newspaper } from 'lucide-react'
import './MobileNavigation.css'

const items = [
  { to: '/', label: '뉴스', Icon: Newspaper },
  { to: '/markets', label: '시장', Icon: ChartNoAxesCombined },
  { to: '/calendar', label: '캘린더', Icon: CalendarDays },
  { to: '/saved', label: '관심목록', Icon: Bookmark },
  { to: '/more', label: '더보기', Icon: Menu },
]

export default function MobileNavigation() {
  const { pathname } = useLocation()
  const [editing, setEditing] = useState(false)
  const bar = useRef<HTMLElement>(null)
  useEffect(() => {
    const measure = () => {
      const height = bar.current?.getBoundingClientRect().height
      if (height) document.documentElement.style.setProperty('--mobile-nav-height', `${Math.ceil(height)}px`)
    }
    const observer = new ResizeObserver(measure)
    if (bar.current) observer.observe(bar.current)
    measure()
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--mobile-nav-height') }
  }, [])
  useEffect(() => {
    const update = () => {
      const active = document.activeElement
      setEditing(hideMobileNavigation(active instanceof HTMLElement && isTextEntry(active), window.innerHeight, window.visualViewport))
    }
    // Run after focus has moved, so moving between inputs does not flash the bar.
    const onFocus = () => queueMicrotask(update)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', onFocus)
    window.visualViewport?.addEventListener('resize', update)
    window.addEventListener('resize', update)
    update()
    return () => {
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', onFocus)
      window.visualViewport?.removeEventListener('resize', update)
      window.removeEventListener('resize', update)
    }
  }, [pathname])
  const selected = mobileSection(pathname)
  return <nav ref={bar} className={`mobile-navigation${editing ? ' is-editing' : ''}`} aria-label="모바일 주요 메뉴">
    {items.map(item => <Link key={item.to} to={item.to} aria-current={selected === item.to ? 'page' : undefined}>
      <span className="mobile-navigation-icon" aria-hidden="true"><item.Icon strokeWidth={1.8} focusable="false" /></span>
      <span className="mobile-navigation-label">{item.label}</span>
    </Link>)}
  </nav>
}
