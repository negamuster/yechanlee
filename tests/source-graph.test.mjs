import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const checker = fileURLToPath(new URL('../scripts/check-source-graph.mjs', import.meta.url))
async function check(files) {
  const directory = await mkdtemp(join(tmpdir(), 'anthracite-source-graph-'))
  try {
    for (const [name, text] of Object.entries(files)) {
      const target = join(directory, name)
      await mkdir(join(target, '..'), { recursive: true })
      await writeFile(target, text)
    }
    return spawnSync(process.execPath, [checker], { cwd: directory, encoding: 'utf8' })
  } finally { await rm(directory, { recursive: true, force: true }) }
}

test('source graph accepts static, lazy, re-export, type, CSS and JSON dependencies', async () => {
  const result = await check({
    'src/main.tsx': "import './page'; import './styles.css'; import type { Item } from './types'; void import('./lazy')",
    'src/page.tsx': "export { value } from './value'",
    'src/value.ts': 'export const value = 1',
    'src/lazy.tsx': "import data from './data.json'; export default data",
    'src/data.json': '{"value":1}',
    'src/types.ts': 'export interface Item { value: number }',
    'src/styles.css': '@import "./theme.css";',
    'src/theme.css': ':root { color: black; }',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /8 app-reachable/)
})

test('source graph rejects a component used only by tests', async () => {
  const result = await check({
    'src/main.tsx': 'export default null',
    'src/Obsolete.tsx': 'export default null',
    'tests/obsolete.test.mjs': "import '../src/Obsolete.tsx'",
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /App-unreachable source files/)
  assert.match(result.stderr, /Obsolete.tsx/)
})

test('source graph rejects a missing local dependency instead of silently skipping it', async () => {
  const result = await check({ 'src/main.tsx': "import './missing'" })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Missing local import/)
})
