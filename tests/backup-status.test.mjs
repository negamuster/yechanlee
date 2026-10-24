import test from 'node:test'
import assert from 'node:assert/strict'
import { BACKUP_STATUS_KEY, readBackupRequest, savedDigest, backupComparison } from '../src/lib/backupStatus.ts'
import { emptySaved, exportSaved, importSaved } from '../src/lib/savedItems.ts'
const at = '2026-10-20T00:00:00.000Z'
test('digest compares the saved payload, including same-count edits, archived evidence and judgment references', async () => {
  const evidence = { id: 'source', kind: 'news', role: 'counter', title: 'News', publisher: 'Publisher', url: 'https://example.com', stale: false, facts: [], links: [], caveat: '', attachedAt: at, reason: '', archivedAt: at }
  const data = { ...emptySaved(), theses: [{ ticker: 'SATL', name: 'Satellogic', revision: 'r', createdAt: at, updatedAt: at, reasons: ['Original', '', ''], counter: '', next: '', reviewDate: '', history: [{ id: 'h', at, judgment: 'pending', reason: 'Wait', evidenceIds: ['source'] }], evidence: [evidence] }] }
  const digest = await savedDigest(data), request = { version: 1, requestedAt: at, digest }
  assert.match(digest, /^[a-f0-9]{64}$/)
  assert.equal(backupComparison(request, await savedDigest(importSaved(exportSaved(data)))), 'same')
  for (const edit of [d => d.theses[0].reasons[0] = 'Edited', d => delete d.theses[0].evidence[0].archivedAt, d => d.theses[0].history[0].evidenceIds = []]) {
    const changed = structuredClone(data); edit(changed)
    assert.equal(backupComparison(request, await savedDigest(changed)), 'changed')
  }
  assert.equal(backupComparison(null, digest), 'none')
  assert.equal(backupComparison({ ...request, digest: null }, digest), 'unknown')
  assert.equal(backupComparison(request, null), 'unknown')
})
test('metadata is separate, bounded and strict; missing/blocked/malformed storage are distinguishable', () => {
  assert.equal(readBackupRequest({ getItem: () => null }), null)
  assert.throws(() => readBackupRequest({ getItem: () => { throw new Error('blocked') } }), /blocked/)
  const good = { version: 1, requestedAt: at, digest: 'a'.repeat(64) }
  assert.deepEqual(readBackupRequest({ getItem: key => { assert.equal(key, BACKUP_STATUS_KEY); return JSON.stringify(good) } }), good)
  for (const raw of ['bad', '{}', JSON.stringify({ ...good, digest: 'short' }), JSON.stringify({ ...good, requestedAt: '2026-02-30T00:00:00.000Z' }), ' '.repeat(513)]) assert.throws(() => readBackupRequest({ getItem: () => raw }))
  assert.deepEqual(readBackupRequest({ getItem: () => JSON.stringify({ ...good, digest: null }) }), { ...good, digest: null })
})
