import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Kreators Life',
        short_name: 'Kreators',
        description: 'A daily game for the seven relationships that make a life. One tower, a few boxes to tick every day.',
        theme_color: '#4F3422',
        background_color: '#F7F4F2',
        display: 'standalone',
        start_url: '/today',
        scope: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [{ urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, handler: 'CacheFirst', options: { cacheName: 'fonts' } }],
      },
    }),
  ],
  server: {
    proxy: { '/api': 'http://localhost:8787', '/go': 'http://localhost:8787' },
  },
});
