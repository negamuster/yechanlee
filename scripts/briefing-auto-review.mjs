// Structural checks for the evidence record; these are not a fact-checking engine.
export function validateAutoReview(item) {
  if (item.review?.mode !== 'automated') return
  const r = item.review
  const approval = Date.parse(r.approvedAt)
  const cutoff = Date.parse(item.cutoffAt)
  if (r.approvedBy !== 'Anthracite automated editorial review' || r.factualReviewPassed !== true || !Array.isArray(r.unresolvedIssues) || r.unresolvedIssues.length) throw Error('Automated review incomplete')
  if (!Array.isArray(r.sourceChecks) || !r.sourceChecks.length) throw Error('Missing source evidence')
  const ids = new Set()
  for (const check of r.sourceChecks) {
    const source = item.sources.find(s => s.id === check.sourceId)
    const allowed = source ? [source.url, ...(source.links || []).map(l => l.url)] : []
    const checked = Date.parse(check.checkedAt)
    if (!source || ids.has(check.sourceId) || !allowed.includes(check.verifiedUrl) || !Number.isFinite(checked) || checked > approval || !check.claimSummary?.trim() || !['primary', 'reported', 'analysis'].includes(check.basis)) throw Error('Invalid source evidence')
    if (check.publishedAt !== null && (!Number.isFinite(Date.parse(check.publishedAt)) || Date.parse(check.publishedAt) > cutoff)) throw Error('Source after information cutoff')
    ids.add(check.sourceId)
  }
  if (item.sources.some(s => !ids.has(s.id))) throw Error('Missing source evidence')
  const texts = [...item.summary, ...item.blocks.map(b => b.text)]
  for (const t of texts) for (const match of t.matchAll(/\[(\d+)\]/g)) if (!ids.has(Number(match[1]))) throw Error('Unknown source citation')
  if (!texts.some(t => /\[\d+\]/.test(t))) throw Error('Missing source citations')
}
