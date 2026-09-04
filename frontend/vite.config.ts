import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const backendHost = process.env.VITE_BACKEND_HOST ?? 'localhost:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: {
      '/v1': {
        target: `http://${backendHost}`,
        changeOrigin: true,
      },
      '/ws': {
        target: `ws://${backendHost}`,
        ws: true,
      },
    },
  },
})
