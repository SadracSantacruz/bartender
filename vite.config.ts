import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://sadracsantacruz.github.io/bartender/ on GitHub Pages.
  base: process.env.GITHUB_ACTIONS ? '/bartender/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Bar Drill',
        short_name: 'Bar Drill',
        description: 'Drill cocktail recipes — builds, glassware, garnishes and rims.',
        // Must match vite `base` so the installed app opens at the right path.
        start_url: process.env.GITHUB_ACTIONS ? '/bartender/' : '/',
        scope: process.env.GITHUB_ACTIONS ? '/bartender/' : '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0910',
        theme_color: '#0b0910',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Deck JSON is bundled into the JS, but the fonts are separate assets —
        // precache them too so the app looks right with no signal in a bar.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/[^/]+\.(?:json|txt|xml)$/],
      },
    }),
  ],
})
