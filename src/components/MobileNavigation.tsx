import { useEffect, useState } from 'react'
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
  useEffect(() => {
    const update = () => {
      const active = document.activeElement
      setEditing(active instanceof HTMLElement && active.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]), textarea, [contenteditable="true"]'))
    }
    // Run after focus has moved, so moving between inputs does not flash the bar.
    const onFocus = () => queueMicrotask(update)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', onFocus)
    return () => {
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', onFocus)
    }
  }, [])
  const selected = pathname === '/' ? '/' : pathname === '/calendar' ? '/calendar' : pathname === '/saved' ? '/saved' : pathname === '/markets' || pathname === '/equity' || pathname.startsWith('/stock/') ? '/markets' : '/more'
  return <nav className={`mobile-navigation${editing ? ' is-editing' : ''}`} aria-label="모바일 주요 메뉴">
    {items.map(item => <Link key={item.to} to={item.to} aria-current={selected === item.to ? 'page' : undefined}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.icon} /></svg>
      <span>{item.label}</span>
    </Link>)}
  </nav>
}
