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
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'kreators.app',
        short_name: 'kreators',
        description: 'A daily game for the seven relationships that make a life. Seven areas, a few boxes to tick every day.',
        theme_color: '#262626',
        background_color: '#F4F4F4',
        display: 'standalone',
        start_url: '/today',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // The main script is close to 2 MiB; a little room so one more screen does not stop the build.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//],
        // The fonts are ours (public/fonts), so they are precached with the rest and work offline.
        globPatterns: ['**/*.{js,css,html,woff2}'],
      },
    }),
  ],
  build: {
    // Source maps stay off. The big libraries get their own files, which change rarely, so a new release
    // re-downloads only the app's own code and the browser keeps the rest.
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // The shared domain model is one 690 KB source file that every screen draws from, so it is one file of its own,
          // cached apart from the app's screens (it cannot be split further without splitting the package).
          // The journal prompts (a large list of text) download only when Prompt me opens, so they are not in the shared file.
          if (id.includes('/packages/shared/src/journalPrompts')) return 'journal-prompts';
          if (id.includes('/packages/shared/src/')) return 'shared';
          if (!id.includes('/node_modules/')) return undefined;
          if (/\/node_modules\/(react|react-dom|scheduler|react-router)\//.test(id)) return 'vendor-react';
          if (id.includes('/node_modules/@tanstack/')) return 'vendor-query';
          if (/\/node_modules\/gsap\//.test(id)) return 'vendor-gsap';
          if (/\/node_modules\/(motion|framer-motion|motion-dom|motion-utils)\//.test(id)) return 'vendor-motion';
          return undefined;
        },
      },
    },
  },
  server: {
    proxy: { '/api': 'http://localhost:8787', '/go': 'http://localhost:8787', '/out': 'http://localhost:8787' },
  },
});
