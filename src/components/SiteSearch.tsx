import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import CommandPalette from './CommandPalette'
import './SiteSearch.css'

export default function SiteSearch({ onSelect }: { onSelect: () => void }) {
  const [opened, setOpened] = useState(false)
  const location = useLocation()
  const [routeKey, setRouteKey] = useState(location.key)
  if (routeKey !== location.key) { setRouteKey(location.key); setOpened(false) }
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.isComposing || event.repeat || event.altKey || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      if (document.querySelector('dialog[open]:not(#site-command-menu)')) return
      event.preventDefault()
      setOpened(value => !value)
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  return <>
    <div className="site-search site-search-launch"><button type="button" className="site-search-trigger" aria-label="통합 검색·빠른 이동" aria-haspopup="dialog" aria-controls={opened ? 'site-command-menu' : undefined} aria-expanded={opened} onClick={() => setOpened(true)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
      <span>종목·뉴스·페이지 검색</span><kbd>⌘K / Ctrl K</kbd>
    </button></div>
    {opened && <CommandPalette onClose={() => setOpened(false)} onSelect={onSelect} />}
  </>
}
