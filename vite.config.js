import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/leaderboard/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:6009',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
