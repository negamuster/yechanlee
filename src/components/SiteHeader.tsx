import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import './SiteHeader.css'
const links = [['/', '홈'], ['/equity', '주식시장'], ['/rates', '금리·채권'], ['/fed', '연준·통화정책'], ['/indicators', '경제지표'], ['/macro', '글로벌 매크로']]
export default function SiteHeader() {
  const [open, setOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  function close() { setOpen(false); setToolsOpen(false); setContactOpen(false) }
  return <header className="site-header" onKeyDown={e => { if (e.key === 'Escape') close() }}>
    <div className="site-header-top">
      <NavLink to="/" className="site-brand" onClick={close}>Anthracite</NavLink>
      <form className="site-search" onSubmit={e => { e.preventDefault(); const q = query.trim().toUpperCase(); if (q) { navigate(`/stock/${encodeURIComponent(q)}`); close() } }}>
        <label className="news-sr-only" htmlFor="site-stock-search">종목 티커 검색</label>
        <input id="site-stock-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="티커 검색 (NVDA, AAPL…)" />
        <button type="submit" aria-label="종목 검색">→</button>
      </form>
      <div className="site-contact">
        <button type="button" aria-expanded={contactOpen} aria-controls="site-contact-links" onClick={() => setContactOpen(!contactOpen)}>Contact {contactOpen ? '−' : '+'}</button>
        {contactOpen && <div id="site-contact-links" className="site-contact-links">
          <a href="mailto:yechan030102@gmail.com">yechan030102@gmail.com</a>
          <a href="https://www.linkedin.com/in/yechanlee030102" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>
        </div>}
      </div>
      <button className="site-menu-toggle" type="button" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen(!open)}>메뉴 {open ? '닫기' : '열기'}</button>
    </div>
    <nav id="site-menu" className={`site-menu${open ? ' is-open' : ''}`} aria-label="주요 메뉴">
      {links.map(([to, label]) => <NavLink key={to} to={to} end onClick={close}>{label}</NavLink>)}
      <div className="site-tools">
        <button type="button" aria-expanded={toolsOpen} aria-controls="site-tools-links" onClick={() => setToolsOpen(!toolsOpen)}>투자 도구 {toolsOpen ? '−' : '+'}</button>
        {toolsOpen && <div id="site-tools-links" className="site-tools-links">
          <NavLink to="/form13f" onClick={close}>기관 포트폴리오 · 13F</NavLink>
          <NavLink to="/simulator" onClick={close}>자산 시뮬레이터</NavLink>
        </div>}
      </div>
    </nav>
  </header>
}
