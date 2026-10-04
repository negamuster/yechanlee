import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const root = new URL('../', import.meta.url)
test('every public route supports direct access and refresh on Vercel', () => {
  const app = readFileSync(new URL('src/App.tsx', root), 'utf8')
  const config = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8'))
  for (const [, route] of app.matchAll(/<Route path="([^"]+)"/g)) {
    if (route === '/') continue
    assert.ok(config.rewrites.some(rule => rule.source === route && rule.destination === '/index.html'), route)
  }
})
test('install metadata references real, correctly sized icons and valid shortcuts', () => {
  const manifest = JSON.parse(readFileSync(new URL('public/manifest.webmanifest', root), 'utf8'))
  const html = readFileSync(new URL('index.html', root), 'utf8')
  assert.ok(html.includes('href="/manifest.webmanifest"'))
  assert.ok(html.includes('href="/app-icon-180.png"'))
  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.display, 'standalone')
  for (const icon of manifest.icons) {
    const png = readFileSync(new URL(`public${icon.src}`, root))
    assert.equal(png.subarray(1, 4).toString(), 'PNG')
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes)
  }
  const config = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8'))
  for (const shortcut of manifest.shortcuts) assert.ok(config.rewrites.some(rule => rule.source === shortcut.url))
})
