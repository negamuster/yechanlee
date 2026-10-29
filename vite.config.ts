// @ts-expect-error Shared economic dashboard server handler.
import economicAPI from './api/economic-indicators.js'
// @ts-expect-error Shared calendar server handler.
import calendarAPI from './api/calendar.js'
// @ts-expect-error Shared JavaScript server handler.
import sectorAPI from './api/sector-performance.js'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { gzipSync } from 'node:zlib'
// @ts-expect-error The same JavaScript Node.js handler also serves local development.
import newsAPI from './api/news.js'
// @ts-expect-error Shared JavaScript server handler.
import indicesAPI from './api/market-indices.js'
// @ts-expect-error Shared server implementation for the local API.
import { createMoversHandler } from './lib/market-movers.js'

// @ts-expect-error Shared server implementation.
import { createStockHandler } from './lib/stock-data.js'
// @ts-expect-error Shared server implementation.
import { createAnalysisHandler } from './lib/stock-analysis.js'

// @ts-expect-error Shared SEC server handler.
import { create13FHandler } from './lib/form13f.js'
// @ts-expect-error Shared stock chart server handler.
import { createStockChartHandler } from './lib/stock-chart.js'
// @ts-expect-error Shared SEC annual financials server handler.
import { createFinancialsHandler } from './lib/stock-financials.js'

export default defineConfig({
  // Only this non-secret setting may be exposed to browser code.
  envPrefix: 'VITE_YAHOO_LIVE_VIDEO_ID',
  build: { emptyOutDir: true, manifest: true },
  plugins: [react(), {
    name: 'initial-loading-budget',
    apply: 'build',
    generateBundle(_options, bundle) {
      const initial = new Set<string>()
      const visit = (file: string) => {
        if (initial.has(file)) return
        const chunk = bundle[file]
        if (chunk?.type !== 'chunk') return
        initial.add(file)
        chunk.imports.forEach(visit)
      }
      for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk' && chunk.isEntry) visit(chunk.fileName)
      const deferred = ['/src/data/published-briefings.json', '/src/lib/briefingArchive.ts', '/src/components/CommandPalette.tsx', '/config/sec-monitor.json']
      let bytes = 0, gzipBytes = 0
      for (const file of initial) {
        const chunk = bundle[file]
        if (chunk.type !== 'chunk') continue
        for (const id of Object.keys(chunk.modules)) if (deferred.some(path => id.split('?')[0].endsWith(path))) this.error(`Deferred module leaked into initial JavaScript: ${id}`)
        bytes += Buffer.byteLength(chunk.code)
        gzipBytes += gzipSync(chunk.code).byteLength
      }
      if (!initial.size || bytes > 700_000 || gzipBytes > 210_000) this.error(`Initial JavaScript budget exceeded: ${bytes} bytes / ${gzipBytes} gzip bytes (limits 700000 / 210000)`)
      const metrics = { bytes, gzipBytes, files: [...initial].sort(), limits: { bytes: 700_000, gzipBytes: 210_000 } }
      this.emitFile({ type: 'asset', fileName: '.vite/initial-loading.json', source: JSON.stringify(metrics, null, 2) + '\n' })
      console.log(`Initial JavaScript: ${bytes} bytes / ${gzipBytes} gzip bytes across ${initial.size} static chunks`)
    },
  }, {
    name: 'local-news-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      const filingHandler = create13FHandler()
      const handlers: Record<string, (req: Request) => Promise<Response>> = {
        '/api/calendar': calendarAPI.fetch,
        '/api/economic-indicators': economicAPI.fetch,
        '/api/form13f': filingHandler,
        '/api/stock-chart': createStockChartHandler(),
        '/api/stock-financials': createFinancialsHandler(),
        '/api/sector-performance': sectorAPI.fetch,
        '/api/stock-data': createStockHandler({ getKey: () => process.env.POLYGON_KEY || env.POLYGON_KEY || env.VITE_POLYGON_KEY }),
        '/api/claude-proxy': createAnalysisHandler(),
      }
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0] || ''
        const handler = handlers[path]
        if (!handler) return next()
        try {
          const chunks: Buffer[] = []; let length = 0
          for await (const chunk of req) {
            length += chunk.length
            if (length > 16000) { res.statusCode = 413; res.end('Request too large'); return }
            chunks.push(Buffer.from(chunk))
          }
          const headers = new Headers()
          for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(',') : value)
          const response = await handler(new Request(`http://${req.headers.host}${req.url}`, {
            method: req.method, headers,
            ...(req.method === 'POST' ? { body: Buffer.concat(chunks) } : {}),
          }))
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch { res.statusCode = 503; res.end(JSON.stringify({ error: 'Service unavailable' })) }
      })
      const moversHandler = createMoversHandler({ getKey: () => process.env.POLYGON_KEY || env.POLYGON_KEY || env.VITE_POLYGON_KEY })
      server.middlewares.use('/api/market-movers', async (req, res, next) => {
        if (req.url?.split('?')[0] !== '/') return next()
        try {
          const response: Response = await moversHandler(new Request('http://localhost/api/market-movers', { method: req.method }))
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(await response.text())
        } catch {
          res.statusCode = 503
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'unavailable' }))
        }
      })
      server.middlewares.use('/api/market-indices', async (req, res, next) => {
        if (req.url?.split('?')[0] !== '/') return next()
        try {
          const response: Response = await indicesAPI.fetch(new Request('http://localhost/api/market-indices', { method: req.method }))
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(await response.text())
        } catch {
          res.statusCode = 503
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'News temporarily unavailable' }))
        }
      })
      server.middlewares.use('/api/news', async (req, res, next) => {
        if (req.url?.split('?')[0] !== '/') return next()
        try {
          const response: Response = await newsAPI.fetch(new Request('http://localhost/api/news', { method: req.method }))
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(await response.text())
        } catch {
          res.statusCode = 503
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'News temporarily unavailable' }))
        }
      })
    },
  }],
})

