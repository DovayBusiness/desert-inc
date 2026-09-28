import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Builds straight into the repo root so GitHub Pages can serve it as a
// plain static site — no CI/build step needed on the hosting side.
// assetsDir is renamed so Vite's hashed JS/CSS bundle doesn't collide with
// our own /assets/models and /assets/textures folder at the repo root.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../',
    assetsDir: 'app-assets',
    emptyOutDir: false,
  },
})
