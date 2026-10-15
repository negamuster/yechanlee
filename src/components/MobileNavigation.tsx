import { useEffect, useRef, useState } from 'react'
import { hideMobileNavigation, isTextEntry, mobileSection } from '../lib/mobileUI'
import { Link, useLocation } from 'react-router-dom'
import './MobileNavigation.css'

const items = [
  { to: '/', label: '뉴스', icon: 'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5' },
  { to: '/markets', label: '시장', icon: 'M4 19h16 M6 15V9 M12 15V5 M18 15v-4' },
  { to: '/calendar', label: '캘린더', icon: 'M4 5h16v15H4z M8 3v4 M16 3v4 M4 10h16 M8 14h2 M14 14h2' },
  { to: '/saved', label: '관심목록', icon: 'M6 3h12v18l-6-4-6 4z' },
  { to: '/more', label: '더보기', icon: 'M5 6h14 M5 12h14 M5 18h14' },
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
      <span className="mobile-navigation-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg></span>
      <span className="mobile-navigation-label">{item.label}</span>
    </Link>)}
  </nav>
}
