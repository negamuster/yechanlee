import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { publishable } from '../scripts/briefing-publication.mjs'

test('the small home payload is exactly the latest reviewed publication, including original basis and citations', async () => {
  const dir = new URL('../content/briefings/', import.meta.url)
  const originals = await Promise.all((await readdir(dir)).filter(name => name.endsWith('.json')).map(async name => JSON.parse(await readFile(new URL(name, dir), 'utf8'))))
  const published = JSON.parse(JSON.stringify(publishable(originals)))
  const archive = JSON.parse(await readFile(new URL('../src/data/published-briefings.json', import.meta.url), 'utf8'))
  const latest = JSON.parse(await readFile(new URL('../src/data/latest-briefing.json', import.meta.url), 'utf8'))
  assert.deepEqual(archive, published, 'Run scripts/build-briefings.mjs after changing approved content')
  assert.deepEqual(latest, published[0] ?? null, 'Home and archive must publish the same reviewed edition')
  assert.equal(Array.isArray(latest), false, 'Home must never bundle the entire archive')
})
