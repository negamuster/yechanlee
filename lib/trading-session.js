const DAY = 86400000
export function nyDate(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
// Daily aggregates may include extended-hours trades. Wait until 21:00 ET,
// one hour after the extended session, then validate availability separately.
export function latestDailyDate(now = Date.now()) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23' }).format(now))
  const today = nyDate(now)
  return hour >= 21 ? today : new Date(Date.parse(`${today}T12:00:00Z`) - DAY).toISOString().slice(0, 10)
}
