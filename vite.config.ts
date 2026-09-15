import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  server: { allowedHosts: ['bridge.82-26-151-8.sslip.io'], hmr: { clientPort: 443 } },
  plugins: [react()],
})
