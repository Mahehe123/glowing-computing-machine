import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base + HashRouter => works on GitHub Pages project sites
// (https://<user>.github.io/<repo>/) with no SPA-fallback config needed.
export default defineConfig({
  plugins: [react()],
  base: './',
})
