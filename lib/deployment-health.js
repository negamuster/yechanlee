import { PRODUCTION_ORIGIN } from './stock-health.js'

export async function waitForProductionCommit(commit, { fetcher = fetch, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), timeoutMs = 180000 } = {}) {
  if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('Expected a commit SHA')
  const deadline = now() + timeoutMs
  do {
    try {
      const response = await fetcher(`${PRODUCTION_ORIGIN}/build-info.json?commit=${commit}`, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) })
      if (response.ok && (await response.json()).commit === commit) return
    } catch { /* A pending deployment may still serve 404 or the previous build. */ }
    await sleep(5000)
  } while (now() < deadline)
  throw new Error('Production has not published the expected commit; API checks were not run')
}
