import test from 'node:test'
import assert from 'node:assert/strict'
import './helpers/register-tsx.mjs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { load } from 'cheerio'

const { default: MobileNavigation } = await import('../src/components/MobileNavigation.tsx')
const items = [['/', '뉴스'], ['/markets', '시장'], ['/calendar', '캘린더'], ['/saved', '관심목록'], ['/more', '더보기']]
const render = pathname => load(renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [pathname] }, createElement(MobileNavigation))))

test('every page keeps the same five ordered, labelled mobile destinations and icon/label structure', () => {
  for (const route of ['/', '/markets', '/calendar', '/saved', '/more', '/stock/TSLA', '/briefings/2026-10-15', '/saved/thesis/TSLA']) {
    const $ = render(route)
    assert.equal($('nav').attr('aria-label'), '모바일 주요 메뉴')
    assert.deepEqual($('nav a').toArray().map(link => [$(link).attr('href'), $(link).text()]), items)
    assert.equal($('.mobile-navigation-icon[aria-hidden=true] svg').length, 5)
    assert.equal($('.mobile-navigation-label').length, 5)
  }
})
test('all top-level and detail pages expose exactly one selected tab in their own section', () => {
  const routes = {
    '/': '/', '/briefings': '/', '/briefings/2026-10-15': '/', '/briefings/methodology': '/',
    '/markets': '/markets', '/equity': '/markets', '/rates': '/markets', '/fed': '/markets', '/indicators': '/markets', '/macro': '/markets', '/stock/BRK.B': '/markets',
    '/calendar': '/calendar', '/saved': '/saved', '/saved/thesis/TSLA': '/saved',
    '/more': '/more', '/live': '/more', '/simulator': '/more', '/form13f': '/more',
  }
  for (const [pathname, selected] of Object.entries(routes)) {
    const $ = render(pathname)
    assert.equal($('a[aria-current=page]').length, 1, pathname)
    assert.equal($('a[aria-current=page]').attr('href'), selected, pathname)
    assert.equal($('a[aria-current=page] .mobile-navigation-icon').length, 1)
  }
})

const { default: SiteHeader } = await import('../src/components/SiteHeader.tsx')
const { desktopLinks } = await import('../src/lib/navigation.ts')
test('desktop detail routes retain one parent menu selection and every destination stays in order', () => {
  for (const [path, selected] of [['/', '/'], ['/stock/AAPL', '/equity'], ['/briefings/2026-10-31', '/'], ['/saved/thesis/AAPL', '/saved'], ['/filings', '/filings'], ['/more', null]]) {
    const $ = load(renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(SiteHeader))))
    const links = $('#site-menu a')
    assert.deepEqual(links.toArray().map(link => [$(link).attr('href'), $(link).text()]), desktopLinks.map(link => [link.to, link.label]))
    assert.equal($('#site-menu [aria-current=page]').length, selected ? 1 : 0, path)
    if (selected) assert.equal($('#site-menu [aria-current=page]').attr('href'), selected)
  }
})
