const MINUTE = 60000
const DAY = 24 * 60 * MINUTE

// Never expose upstream response bodies, URLs or headers in public diagnostics.
export function sourceFailure(code, retryAfter = null) {
  return Object.assign(new Error(code), { code, retryAfter })
}
export function retryDeadline(error, now, failures = 1) {
  const code = error?.code || ''
  const floor = /^http_(404|410)$/.test(code) || code === 'invalid_configuration' ? 6 * 60 * MINUTE
    : code === 'http_403' ? 30 * MINUTE : code === 'http_429' ? 15 * MINUTE
      : Math.min(15, 2 ** Math.min(4, Math.max(0, failures - 1))) * MINUTE
  let advised = 0
  const value = error?.retryAfter
  if (/^http_(429|503)$/.test(code) && typeof value === 'string') {
    if (/^\d+$/.test(value.trim())) advised = Math.min(DAY, Number(value.trim()) * 1000)
    else if (/GMT$/i.test(value.trim())) {
      const at = Date.parse(value)
      if (Number.isFinite(at)) advised = Math.min(DAY, Math.max(0, at - now))
    }
  }
  return now + Math.max(floor, advised)
}
