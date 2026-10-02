import { createCalendarHandler } from '../lib/calendar.js'
import blsSnapshot from '../data/bls-calendar.json' with { type: 'json' }
export default { fetch: createCalendarHandler({
  blsSnapshot,
  snapshotUrl: 'https://raw.githubusercontent.com/negamuster/yechanlee/main/data/bls-calendar.json',
}) }
