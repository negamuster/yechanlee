import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error The same JavaScript Node.js handler also serves local development.
import newsAPI from './api/news.js'
// @ts-expect-error Shared JavaScript server handler.
import indicesAPI from './api/market-indices.js'
// @ts-expect-error Shared server implementation for the local API.
import { createMoversHandler } from './lib/market-movers.js'

export default defineConfig({
  plugins: [react(), {
    name: 'local-news-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
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
