// Presentation records remain part of the reviewed content hash.
// These checks validate shape, attribution and timing, not financial truth.
export function validateBriefingHomepage(item) {
  const home = item.homepage
  if (home === undefined) {
    if (item.review?.mode === 'automated' && item.id >= '2026-10-15') throw Error(`Missing briefing homepage: ${item.id}`)
    return
  }
  const fail = () => { throw Error(`Invalid briefing homepage: ${item.id}`) }
  const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max
  const known = new Set(item.sources.map(s => s.id))
  const citations = value => [...value.matchAll(/\[(\d+)\]/g)].map(m => Number(m[1]))
  const refs = ids => Array.isArray(ids) && ids.length > 0 && ids.length <= known.size && new Set(ids).size === ids.length && ids.every(id => Number.isInteger(id) && known.has(id))
  if (!home || typeof home !== 'object' || !text(home.headline, 140) || !refs(citations(home.headline))) fail()
  for (const [field, max] of [['stocks', 4], ['assets', 4], ['events', 3]]) {
    if (!Array.isArray(home[field]) || home[field].length > max) fail()
  }
  for (const stock of home.stocks) {
    if (!stock || !text(stock.name, 50) || !text(stock.ticker, 12) || !/^[A-Z0-9.^-]+$/.test(stock.ticker) || !text(stock.change, 30) || !text(stock.reason, 180) || !text(stock.basis, 140) || !refs(stock.sourceIds)) fail()
  }
  for (const asset of home.assets) {
    if (!asset || !text(asset.label, 50) || !text(asset.value, 70) || !text(asset.change, 40) || !text(asset.basis, 180) || !refs(asset.sourceIds)) fail()
  }
  const cutoff = Date.parse(item.cutoffAt)
  for (const event of home.events) {
    const at = event && Date.parse(event.at)
    if (!event || !text(event.at, 40) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(event.at) || !Number.isFinite(at) || at <= cutoff || at > cutoff + 72 * 3600000 || !text(event.label, 100) || (event.detail !== undefined && !text(event.detail, 180)) || !refs(event.sourceIds)) fail()
  }
  for (const row of [...home.stocks, ...home.assets, ...home.events]) {
    for (const value of Object.values(row)) {
      if (typeof value === 'string' && citations(value).some(id => !known.has(id))) fail()
    }
  }
}
