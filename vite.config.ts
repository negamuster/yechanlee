import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/yq1': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yq1/, ''),
        headers: YF_HEADERS,
      },
      '/yq2': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/yq2/, ''),
        headers: YF_HEADERS,
      },
    },
  },
})