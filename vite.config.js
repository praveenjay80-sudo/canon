import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Backend routes live in server.js (Express) — run `node server.js`
      // alongside `npm run dev` to exercise them locally.
      '/api': 'http://localhost:3000',
    },
  },
})
