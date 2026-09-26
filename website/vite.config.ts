import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Keep the documentation site from occupying the desktop app's fixed
    // Electron development port (5173).
    port: 5174,
  },
})
