import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { siteUrl } from '../../packages/shared/src/siteMeta.ts';

export default defineConfig({
  // The production origin a public page's canonical names (lib/usePageMeta.ts), the same one scripts/seo/build-static.mjs writes into the
  // built pages: SITE_URL at build time, else https://kreators.app. Never the host the page happens to be open on.
  define: { __SITE_URL__: JSON.stringify(siteUrl(process.env.SITE_URL)) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'kreators.app',
        short_name: 'kreators',
        description: 'A daily game for the seven relationships, with a creator\'s tools built in.',
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
        // The service worker never answers these with the app shell: the API, the Worker's redirects, /.well-known, and the files written
        // for crawlers (robots.txt, llms.txt, llms-full.txt, sitemap.xml), which must reach the network as themselves.
        navigateFallbackDenylist: [/^\/api\//, /^\/(?:go|out)\//, /^\/\.well-known\//, /\.(?:txt|xml|md)$/],
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
          // The shared domain model (a barrel over one file per domain) is what every screen draws from, so it is one chunk of its own,
          // cached apart from the app's screens.
          // The journal prompts (a large list of text) download only when Prompt me opens, so they are not in the shared chunk.
          if (id.includes('/packages/shared/src/journalPrompts')) return 'journal-prompts';
          if (id.includes('/packages/shared/src/agencyEmail')) return 'agency-email';
          // The value goals and projects on offer (a subpath export, text only the strategy session and the vibe check read).
          if (id.includes('/packages/shared/src/ladderChoices')) return 'ladder-choices';
          // Daily's block hints (a subpath export: a suggestion inside a block and the quiet mismatch line), read only by the grouped view
          // and the task form, both lazy; it imports the rest of shared and shared never imports it, so no cycle.
          if (id.includes('/packages/shared/src/blockHints')) return 'block-hints';
          // Content days' step lists and the breakdown rule (2026-11-12; a subpath export that imports the rest of shared and that nothing in the barrel imports, like blockHints), read by Daily's blocks.
          if (id.includes('/packages/shared/src/contentDays.ts')) return 'shared-content-days';
          // How each app works (HOW_TO, about 40 kB of text) left the barrel on 2026-11-07: help.ts is the subpath export
          // `@kreators/shared/help`, read only by the How it works card (components/HowItWorksPanel.tsx, fetched the first time a screen
          // shows the section) and the tests. It imports the rest of shared and nothing in the barrel imports it, so no cycle; the glossary
          // (TERMS) stayed in the barrel as terms.ts. Before: entry 477.9 kB, first download 1,495.6 kB, shared 399.9 kB.
          if (id.includes('/packages/shared/src/help.ts')) return 'shared-help';
          // A lesson's resources (a subpath export that reads the rest of shared, like blockHints, and that nothing in the barrel imports), read only by the lazy cohort page.
          if (id.includes('/packages/shared/src/lessonResources.ts')) return 'lesson-resources';
          // Gratitude for the day's prompts (a subpath export and a leaf: it imports only types), read only by the Journal screen.
          if (id.includes('/packages/shared/src/gratitude.ts')) return 'gratitude';
          // Fitness's model (a subpath export: the movement kinds, the readers and the eating score) is a leaf (it imports only types), read by
          // the Fitness screen and Kreators Run's tool, both lazy, so it loads with them and never with the first download.
          if (id.includes('/packages/shared/src/fitness.ts')) return 'shared-fitness';
          // Close the unfinished's words (a subpath export and a leaf: it imports only types), read only by the lazy Unfinished business tab and task form.
          if (id.includes('/packages/shared/src/openBusiness.ts')) return 'shared-open';
          // A coach's report (a subpath export and a leaf: the section switches and the rules behind suggestions), read by the Coaching screens, both lazy.
          if (id.includes('/packages/shared/src/coachReport.ts')) return 'shared-coach';
          // Connect people's kinds and words (a subpath export and a leaf: it imports nothing), read by Admin's lazy Connect tab and the Profile card.
          if (id.includes('/packages/shared/src/connect.ts')) return 'shared-connect';
          // Joining by invite's words and readers (a subpath export and a leaf: it imports only types), read by Welcome's gate, /join, Admin's Invites and Profile, all lazy.
          if (id.includes('/packages/shared/src/invites.ts')) return 'shared-invites';
          // The public site's words for search engines (every page's title, description and opening, the fair questions, the JSON-LD
          // builders; a subpath export that imports the rest of shared and that nothing in the barrel imports, like blockHints, so no
          // cycle), read through import() by lib/usePageMeta.ts, so it loads after the first paint and never with the shared chunk.
          if (id.includes('/packages/shared/src/siteMeta.ts')) return 'shared-site-meta';
          // The line of the day (a long list of text) is a chunk of its own, which keeps the shared chunk under the 400 kB a chunk may
          // be. It must stay a leaf (lines.ts imports nothing): a split-off file that imports the rest of shared makes a cycle between
          // the two chunks and the app stops at "Cannot access before initialization" (design.ts did, 2026-11-04).
          if (id.includes('/packages/shared/src/lines.ts')) return 'shared-lines';
          // The legal lists (versions, consent purposes, retention, subprocessors) are a leaf too (legal.ts imports nothing), split off
          // for the same reason once Emerging's one-list read (2026-11-05) took the shared chunk past 400 kB.
          if (id.includes('/packages/shared/src/legal.ts')) return 'shared-legal';
          // The focus clock's tab record (a subpath export, not in the barrel) is a leaf only Mindfulness's panel reads, so it loads
          // with that panel. And six small leaves the rest of shared builds on (core, dates, books, store, activity, circles: each
          // imports nothing but types) are one chunk of their own, which kept the shared chunk under 400 kB once time blocks came in
          // (2026-11-06; circles joined when the block colours took it to 400.1 kB; dayKinds, the kinds-of-day reading and
          // `templateForDate`, joined with "Your kinds of day", importing only dates.ts beside it).
          // dayTypes (the kinds of day, a list of text importing only a type) joined on 2026-11-07, when Daily's block hints and the
          // inbox's kinds took the shared chunk to 400.3 kB. money (the currencies, `money()` and `typedCents`, importing only a type)
          // joined the same day, when the year in Reviews, gratitude and Fitness took it to 400.1 kB.
          // Each must stay a leaf, for the reason above.
          if (id.includes('/packages/shared/src/focusRun.ts')) return 'shared-focus-run';
          // Where a helper tooltip goes (2026-11-12; a subpath export and a leaf: it imports nothing), read only by lib/tipGeometry.ts, which the smart
          // tips, a glossary word's card and the assistant's bubble load after the first paint.
          if (id.includes('/packages/shared/src/tipPlace.ts')) return 'tip-place';
          // eventJoin (an event attendee's paths and the public event's type, importing only a type) joined on 2026-11-07, since Shell reads it.
          if (/\/packages\/shared\/src\/(core|dates|books|store|activity|circles|dayKinds|dayTypes|money|eventJoin)\.ts$/.test(id)) return 'shared-base';
          if (id.includes('/packages/shared/src/')) return 'shared';
          // The icons the shared registries name (every app, setup tag, role...) are one map the shell needs, so it is a
          // chunk of its own: preloaded with the first download, but kept out of the entry's 480 kB budget.
          if (id.endsWith('/src/lib/appIcons.ts')) return 'icons-app';
          // The API client is the same: every screen calls it, so it is preloaded with the first download in a file of its own,
          // which keeps the entry under its budget now that motion's core sits there.
          if (id.endsWith('/src/lib/api.ts')) return 'app-api';
          if (!id.includes('/node_modules/')) return undefined;
          // lucide-react's shared drawing code is one small file; each icon stays beside the screen that imports it,
          // never one big file of every icon.
          if (/\/node_modules\/lucide-react\/dist\/esm\/(Icon|createLucideIcon|defaultAttributes|context|shared\/)/.test(id)) return 'vendor-icons';
          // The animated icons' player loads only through import(), after the first paint. Each animation (one to three kB)
          // stays its own small file, fetched only when a screen shows that icon, so the registry can grow without one big file.
          if (id.includes('/node_modules/react-useanimations/lib/')) return undefined;
          if (id.includes('/node_modules/react-useanimations/')) return 'vendor-useanimations';
          if (/\/node_modules\/(react|react-dom|scheduler|react-router)\//.test(id)) return 'vendor-react';
          if (id.includes('/node_modules/@tanstack/')) return 'vendor-query';
          if (/\/node_modules\/gsap\//.test(id)) return 'vendor-gsap';
          // Motion is not named: Rollup puts what the first screens need (the `m` component, AnimatePresence, LazyMotion, the hooks)
          // with the entry, and its animation, drag, layout and gesture code, which lib/motionFeatures.ts loads through import()
          // inside LazyMotion (main.tsx), in a chunk of its own after the first download. A name here would pull all of motion back
          // into one file through its index files.
          return undefined;
        },
      },
    },
  },
  server: {
    proxy: { '/api': 'http://localhost:8787', '/go': 'http://localhost:8787', '/out': 'http://localhost:8787' },
  },
});
