import { json, crossSite } from './api-guards.js'

// Keep a tombstone for old clients. This endpoint never reads credentials or
// contacts an AI provider, even when an old deployment secret remains set.
export function createAnalysisHandler() {
  return async req => {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' })
    if (crossSite(req)) return json({ error: 'Forbidden' }, 403)
    return json({ error: '유료 AI 분석 기능은 종료되었습니다.' }, 410)
  }
}
