import { validateRules } from './briefing-rules.mjs'
import { createHash } from 'node:crypto'
import { validateAutoReview } from './briefing-auto-review.mjs'
export function contentHash(item) {
  const { status, review, ...content } = item
  void status; void review
  return createHash('sha256').update(JSON.stringify(content)).digest('hex')
}
export function publishable(items, now = Date.now()) {
  const ids = new Set()
  return items.filter(item => {
    if (item.status !== 'published') return false
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.id) || ids.has(item.id)) throw Error('Invalid/duplicate briefing date')
    ids.add(item.id)
    const r = item.review
    if (!r?.approvedBy?.trim() || !r.approvedAt || r.contentHash !== contentHash(item)) throw Error(`Unreviewed content: ${item.id}`)
    const cutoff = Date.parse(item.cutoffAt), approval = Date.parse(r.approvedAt), published = Date.parse(item.publishedAt)
    if (![cutoff, approval, published].every(Number.isFinite) || cutoff > approval || approval > published || published > now) throw Error(`Invalid publication times: ${item.id}`)
    if (!item.title?.trim() || !item.summary?.length || !item.blocks?.length || !item.sources?.length || !item.dataNote?.trim()) throw Error(`Incomplete briefing: ${item.id}`)
    const sourceIds = new Set()
    for (const source of item.sources) {
      if (!/^https:\/\//.test(source.url) || !source.label?.trim() || sourceIds.has(source.id)) throw Error(`Invalid source: ${item.id}`)
      sourceIds.add(source.id)
      if (!r.checkedSources?.includes(source.id)) throw Error(`Unchecked source: ${item.id}`)
    }
    if (r.mode && !['manual','automated','rules'].includes(r.mode)) throw Error('Unknown review mode')
    validateAutoReview(item)
    validateRules(item)
    return true
  }).map(item => ({ id:item.id, reviewMode:item.review?.mode === 'rules' ? 'rules' : item.review?.mode === 'automated' ? 'automated' : 'manual', title:item.title, sessionDate:item.sessionDate, cutoffAt:item.cutoffAt, publishedAt:item.publishedAt, summary:item.summary, blocks:item.blocks, sources:item.sources, dataNote:item.dataNote, corrections:item.corrections })).sort((a,b) => b.id.localeCompare(a.id))
}
