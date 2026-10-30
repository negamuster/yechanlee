import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import SearchLoadBoundary, { SearchLoadingDialog } from './SearchLoadBoundary'
import './SiteSearch.css'

const CommandPalette = lazy(() => import('./CommandPalette'))

export default function SiteSearch({ onSelect }: { onSelect: () => void }) {
  const [opened, setOpened] = useState(false)
  const location = useLocation()
  const [routeKey, setRouteKey] = useState(location.key)
  if (routeKey !== location.key) { setRouteKey(location.key); setOpened(false) }
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.isComposing || event.repeat || event.altKey || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      if (document.querySelector('dialog[open]:not(#site-command-menu), [role="dialog"][aria-modal="true"]:not(#site-command-menu)')) return
      event.preventDefault()
      setOpened(value => !value)
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  return <>
    <div className="site-search site-search-launch"><button type="button" className="site-search-trigger" aria-label="통합 검색·빠른 이동" aria-haspopup="dialog" aria-controls={opened ? 'site-command-menu' : undefined} aria-expanded={opened} onClick={() => setOpened(true)}>
      <Search size={18} aria-hidden="true" focusable="false" strokeWidth={1.8} />
      <span>종목·뉴스·페이지 검색</span><kbd>⌘K / Ctrl K</kbd>
    </button></div>
    {opened && <SearchLoadBoundary onClose={() => setOpened(false)}><Suspense fallback={<SearchLoadingDialog onClose={() => setOpened(false)} />}><CommandPalette onClose={() => setOpened(false)} onSelect={onSelect} /></Suspense></SearchLoadBoundary>}
  </>
}
