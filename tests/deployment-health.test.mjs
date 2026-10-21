import test from 'node:test'
import assert from 'node:assert/strict'
import { waitForProductionCommit } from '../lib/deployment-health.js'
const expected = 'a'.repeat(40), old = 'b'.repeat(40)

test('production gate waits through an old build and HTML until the exact deployed commit appears', async () => {
  let now = 0, calls = 0
  await waitForProductionCommit(expected, { now: () => now, sleep: async ms => { now += ms }, fetcher: async (url, init) => {
    assert.equal(new URL(url).origin, 'https://yechanlee.vercel.app')
    assert.equal(init.redirect, 'error')
    calls++
    return calls === 1 ? Response.json({ commit: old }) : calls === 2 ? new Response('<html>not ready</html>') : Response.json({ commit: expected })
  } })
  assert.equal(calls, 3)
  assert.equal(now, 10000)
})

test('a failed deployment or malformed SHA never authorizes API verification of an older build', async () => {
  let now = 0, calls = 0
  const fetcher = async () => { calls++; return Response.json({ commit: old }) }
  await assert.rejects(waitForProductionCommit('invalid', { fetcher }), /commit SHA/)
  assert.equal(calls, 0)
  await assert.rejects(waitForProductionCommit(expected, { fetcher, now: () => now, sleep: async ms => { now += ms }, timeoutMs: 10000 }), /API checks were not run/)
  assert.equal(calls, 2)
})
