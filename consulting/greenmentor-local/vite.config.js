import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Proxy /efdb/* → EFDB backend on 8000
    // Proxy /claude/* → Anthropic API (avoids CORS + keeps API key server-side)
    proxy: {
      '/efdb': {
        target: 'http://localhost:8000',
        rewrite: path => path.replace(/^\/efdb/, '/api'),
        changeOrigin: true,
      },
      '/anthropic': {
        target: 'https://api.anthropic.com',
        rewrite: path => path.replace(/^\/anthropic/, ''),
        changeOrigin: true,
        secure: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // API key injected by vite proxy — never exposed to browser
            proxyReq.setHeader('anthropic-version', '2023-06-01');
            proxyReq.setHeader('x-api-key', process.env.ANTHROPIC_API_KEY || '');
          });
        },
      },
    },
  },
})
