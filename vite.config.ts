import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When developing on mobile devices (e.g. Android), Tauri sets TAURI_DEV_HOST.
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  envDir: './backend',
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || '0.0.0.0',
    hmr: process.env.YORUMI_MOBILE_HMR_HOST ? {
      host: process.env.YORUMI_MOBILE_HMR_HOST,
      clientPort: Number(process.env.YORUMI_MOBILE_HMR_PORT || 5174),
    } : host
      ? {
          protocol: 'ws',
          host,
          port: 5174,
        }
      : undefined,
    watch: {
      // Cargo owns these; watching locked build artifacts (e.g. yorumi_lib.dll) crashes Vite with EBUSY.
      ignored: ['**/src-tauri/**', '**/target/**', '**/backend/dist/**', '**/dist-electron/**', '**/.git/**'],
    },
    proxy: {
      '/avatars': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && 'writeHead' in res && !res.headersSent) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Avatar not found or backend not running' }));
            }
          });
        }
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && 'writeHead' in res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Backend offline', code: 'ECONNREFUSED' }));
            }
          });
        }
      }
    }
  },
  plugins: [
    react()
  ]
}))
