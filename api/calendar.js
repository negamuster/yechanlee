import { createCalendarHandler } from '../lib/calendar.js'
import blsSnapshot from '../data/bls-calendar.json' with { type: 'json' }
import fredSnapshot from '../data/fred-bls-calendar.json' with { type: 'json' }
export default { fetch: createCalendarHandler({
  blsSnapshot,
  fredSnapshot,
  fredSnapshotUrl: 'https://raw.githubusercontent.com/negamuster/yechanlee/main/data/fred-bls-calendar.json',
  snapshotUrl: 'https://raw.githubusercontent.com/negamuster/yechanlee/main/data/bls-calendar.json',
}) }
