import { economicRetrieval, validEconomicSnapshot } from './economic-series.js'

export function economicCollectionReport(snapshot, now = Date.now()) {
  if (!validEconomicSnapshot(snapshot, now)) throw new Error('invalid_collection_report')
  const warnings = [], lines = []
  const summary = ['## Economic collection', '', '| Series | Outcome | Retrieval route | Collected | Attempted | Diagnostics |', '| --- | --- | --- | --- | --- | --- |']
  for (const s of snapshot.series) {
    const route = s.collectedAt ? economicRetrieval(s).label : 'none'
    const status = s.error ? 'FAIL' : s.retrievedVia === 'fred' ? 'WARN' : 'OK'
    const diagnostics = [s.primaryFailureReason && `BLS=${s.primaryFailureReason}`, s.fallbackFailureReason && `FRED=${s.fallbackFailureReason}`, s.error && `collection=${s.failureReason || s.error}`].filter(Boolean).join('; ') || 'none'
    lines.push(`${s.id}: ${status}; ${s.error ? 'collection failed; preserved previous data' : s.observations.length + ' observations'}; via ${route}; collected ${s.collectedAt || 'never'}; attempted ${s.attemptedAt || 'never'}; ${diagnostics}`)
    if (status === 'WARN') warnings.push(`${s.id}: BLS ${s.primaryFailureReason}; verified BLS observations collected via FRED`)
    summary.push(`| ${s.id} | ${status} | ${route} | ${s.collectedAt || 'never'} | ${s.attemptedAt || 'never'} | ${diagnostics} |`)
  }
  summary.push('', 'WARN means a verified fallback succeeded; FAIL means collection failed through all available routes. Original observation periods and collection times are preserved on failure.', '')
  return { lines, warnings, summary: summary.join('\n'), exitCode: snapshot.series.some(s => s.error) ? 1 : 0 }
}
