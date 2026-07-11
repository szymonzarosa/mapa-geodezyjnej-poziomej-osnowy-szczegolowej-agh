import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/mapa-geodezyjnej-poziomej-osnowy-szczegolowej-agh/', 
  server: {
    open: true
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo_agh.svg'],
      manifest: {
        name: 'Mapa Interaktywna Osnowy',
        short_name: 'Osnowa',
        description: 'Inwentaryzacja geodezyjnej osnowy w Krakowie',
        theme_color: '#1a1a1a',
        background_color: '#f3f4f6',
        display: 'standalone',
        start_url: '/mapa-geodezyjnej-poziomej-osnowy-szczegolowej-agh/', 
        icons: [
          {
            src: 'logo_agh.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/szkice/, /porownania/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'], 
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.web3forms\.com\/.*/i,
            handler: 'NetworkOnly',
            method: 'POST'
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-data-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.basemaps\.cartocdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-cache',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:pdf|jpg|jpeg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sketches-and-topo-cache',
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
});