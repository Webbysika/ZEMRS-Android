import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/ZEMRS/',
  plugins: [VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['zambia.svg'],
    manifest: {
      name: 'Zambia Election Monitoring and Results System',
      short_name: 'ZEMRS',
      description: 'Offline-first polling-station monitoring and results dashboard',
      theme_color: '#0b5d3b',
      background_color: '#f4f7f5',
      display: 'standalone',
      start_url: '/ZEMRS/',
      scope: '/ZEMRS/',
      icons: []
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,json,geojson,svg,png}'],
      maximumFileSizeToCacheInBytes: 12000000,
      runtimeCaching: [{
        urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\//,
        handler: 'CacheFirst',
        options: { cacheName: 'map-tiles', expiration: { maxEntries: 1200, maxAgeSeconds: 2592000 } }
      }]
    }
  })],
  build: { chunkSizeWarningLimit: 1200 }
});
