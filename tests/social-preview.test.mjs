import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { load } from 'cheerio'
const root = new URL('../', import.meta.url)
const $ = load(readFileSync(new URL('index.html',root),'utf8'))
const og = key => $(`head meta[property="${key}"]`).attr('content')
const twitter = key => $(`head meta[name="${key}"]`).attr('content')

test('share metadata is available in the original HTML without client-side JavaScript', () => {
  for (const key of ['og:type','og:title','og:description','og:image','og:url','og:site_name','og:image:alt']) {
    assert.equal($(`head meta[property="${key}"]`).length,1)
    assert.ok(og(key)?.trim())
  }
  assert.equal(og('og:type'),'website')
  assert.equal(og('og:url'),'https://yechanlee.vercel.app/')
  assert.equal(og('og:site_name'),'Anthracite')
})
test('the public PNG asset matches the dimensions and format declared to crawlers', () => {
  const url=new URL(og('og:image'))
  assert.equal(url.protocol,'https:')
  assert.equal(url.host,'yechanlee.vercel.app')
  const bytes=readFileSync(new URL(`public${url.pathname}`,root))
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a')
  assert.equal(bytes.readUInt32BE(16),Number(og('og:image:width')))
  assert.equal(bytes.readUInt32BE(20),Number(og('og:image:height')))
  assert.equal(og('og:image:type'),'image/png')
  assert.ok(bytes.length < 500000)
})
test('large-image cards use the same branded asset and descriptive alt text', () => {
  assert.equal(twitter('twitter:card'),'summary_large_image')
  assert.equal(twitter('twitter:image'),og('og:image'))
  assert.equal(twitter('twitter:image:alt'),og('og:image:alt'))
  assert.equal(twitter('twitter:title'),og('og:title'))
  assert.equal(twitter('twitter:description'),og('og:description'))
})
