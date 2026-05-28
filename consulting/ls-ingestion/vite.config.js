import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/efdb': {
          target: 'http://localhost:8000',
          rewrite: path => path.replace(/^\/efdb/, ''),
          changeOrigin: true,
        },
        '/anthropic': {
          target: 'https://api.anthropic.com',
          rewrite: path => path.replace(/^\/anthropic/, ''),
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Strip browser headers so Anthropic treats this as a server request
              // (otherwise it demands anthropic-dangerous-direct-browser-access).
              proxyReq.removeHeader('origin');
              proxyReq.removeHeader('referer');
              proxyReq.setHeader('anthropic-version', '2023-06-01');
              proxyReq.setHeader('x-api-key', env.ANTHROPIC_API_KEY || '');
            });
          },
        },
      },
    },
  }
})
