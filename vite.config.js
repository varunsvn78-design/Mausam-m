import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Single service worker, managed entirely by vite-plugin-pwa (no hand-written
// SW exists anywhere in this repo — nothing to duplicate). Registration is
// handled manually via `virtual:pwa-register/react` in src/components/PwaStatus.jsx,
// so injectRegister is disabled.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        name: 'MAUSAM — Weather Intelligence (Prototype)',
        short_name: 'MAUSAM',
        description:
          'Prototype weather intelligence and daily planning platform. Not an official IMD service. Weather data by Open-Meteo.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#eef2f7',
        theme_color: '#0b6bcb',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Map tiles only. Open-Meteo API responses are deliberately NOT cached
        // by the service worker: offline weather stays Member 1's explicit
        // localStorage cache, which is always labelled as not-live data.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'osm-tiles',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 250, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
})
