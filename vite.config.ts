import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error The same JavaScript Node.js handler also serves local development.
import newsAPI from './api/news.js'

export default defineConfig({
  plugins: [react(), {
    name: 'local-news-api',
    configureServer(server) {
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
