import MarketClocks from './MarketClocks'
import { useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { desktopLinks, desktopSection } from '../lib/navigation'
import './SiteHeader.css'
import SiteSearch from './SiteSearch'
export default function SiteHeader() {
  const { pathname, key } = useLocation()
  const [routeKey, setRouteKey] = useState(key)
  const menuToggle = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  if (routeKey !== key) { setRouteKey(key); setOpen(false); setContactOpen(false) }
  const selected = desktopSection(pathname)
  function close() { setOpen(false); setContactOpen(false) }
  return <header className="site-header" onKeyDown={e => { if (e.key === 'Escape') { if (open) menuToggle.current?.focus(); close() } }}>
    <div className="site-header-shell">
    <div className="site-header-top">
      <NavLink to="/" className="site-brand" onClick={close}>Anthracite</NavLink>
      <SiteSearch onSelect={close} />
      <MarketClocks />
      <div className="site-contact">
        <button type="button" aria-expanded={contactOpen} aria-controls="site-contact-links" onClick={() => setContactOpen(!contactOpen)}>Contact {contactOpen ? '−' : '+'}</button>
        {contactOpen && <div id="site-contact-links" className="site-contact-links">
          <a href="https://negamuster.github.io/" target="_blank" rel="noopener noreferrer">Personal Profile ↗</a>
          <a href="https://www.linkedin.com/in/yechanlee030102" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>
        </div>}
      </div>
      <button ref={menuToggle} className="site-menu-toggle" type="button" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen(!open)}>메뉴 {open ? '닫기' : '열기'}</button>
    </div>
    <nav id="site-menu" className={`site-menu${open ? ' is-open' : ''}`} aria-label="주요 메뉴">
      {desktopLinks.map(({ to, label }) => <Link key={to} to={to} aria-current={selected === to ? 'page' : undefined} className={to === '/calendar' || to === '/saved' ? 'site-menu-section-start' : undefined} onClick={close}>{label}</Link>)}

    </nav>
    </div>
  </header>
}

