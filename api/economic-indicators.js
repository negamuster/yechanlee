import { createEconomicHandler } from '../lib/economic-indicators.js'
import snapshot from '../data/economic-indicators.json' with { type: 'json' }
export default { fetch: createEconomicHandler({ snapshot, snapshotUrl: 'https://raw.githubusercontent.com/negamuster/yechanlee/main/data/economic-indicators.json' }) }
