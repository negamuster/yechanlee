import { createSectorHandler } from '../lib/sector-performance.js'
import { createCompanyMapHandler } from '../lib/company-map.js'
import metadata from '../config/company-map.json' with { type: 'json' }
import snapshot from '../data/company-map.json' with { type: 'json' }
const sectors = createSectorHandler()
const companies = createCompanyMapHandler({ metadata, snapshot })
export default { fetch: request => {
  const query = new URL(request.url).searchParams
  if (!query.size) return sectors(request)
  if (query.size === 1 && query.getAll('view').length === 1 && query.get('view') === 'companies') return companies(request)
  return Response.json({ error: 'Invalid map view' }, { status: 400 })
} }
