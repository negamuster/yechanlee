import { createFinancialsHandler } from '../lib/stock-financials.js'
import snapshot from '../data/sec-financials.json' with { type: 'json' }
export default { fetch: createFinancialsHandler({ snapshot }) }
