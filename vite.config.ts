import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
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

export default defineConfig({
  // Only this non-secret setting may be exposed to browser code.
  envPrefix: 'VITE_YAHOO_LIVE_VIDEO_ID',
  build: { emptyOutDir: true },
  plugins: [react(), {
    name: 'local-news-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      const filingHandler = create13FHandler()
      const handlers: Record<string, (req: Request) => Promise<Response>> = {
        '/api/form13f': filingHandler,
        '/api/stock-data': createStockHandler({ getKey: () => process.env.POLYGON_KEY || env.POLYGON_KEY || env.VITE_POLYGON_KEY }),
        '/api/claude-proxy': createAnalysisHandler({ getKey: () => process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY }),
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
