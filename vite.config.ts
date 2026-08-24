/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path: para GitHub Pages el proyecto se sirve bajo /distilsim/.
// Con GH_PAGES=1 el build genera rutas absolutas /distilsim/assets/...;
// en desarrollo local (npm run dev) la base sigue siendo '/'.
const base = process.env.GH_PAGES === '1' ? '/distilsim/' : '/'

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
