import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://sadracsantacruz.github.io/bartender/ on GitHub Pages.
  base: process.env.GITHUB_ACTIONS ? '/bartender/' : '/',
  plugins: [react(), tailwindcss()],
})
