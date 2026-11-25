import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'prune-legacy-search-manifest',
      closeBundle() {
        // `fast-index-v7.json` (2.43 MB) supersedes `search-manifest.json` (8.76 MB) at runtime;
        // stripping the build-time manifest from `dist/` saves ~8.8 MB in both Android .aab and iOS .ipa!
        const legacyManifest = path.resolve(
          process.cwd(),
          'dist',
          'offline-packs',
          'search-manifest.json'
        );
        const fastIndex = path.resolve(
          process.cwd(),
          'dist',
          'offline-packs',
          'fast-index-v8.json'
        );
        if (fs.existsSync(fastIndex) && fs.existsSync(legacyManifest)) {
          fs.unlinkSync(legacyManifest);
        }
        const staleV7 = path.resolve(
          process.cwd(),
          'dist',
          'offline-packs',
          'fast-index-v7.json'
        );
        if (fs.existsSync(staleV7)) {
          fs.unlinkSync(staleV7);
        }
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      manifest: {
        name: 'ZihinHaritam: Görsel Not & İkon',
        short_name: 'ZihinHaritam',
        description:
          '25.000+ çevrimdışı vektör çıkartma, 60/120 FPS sıfır titremeli tuval ve akademik şema zihin haritası.',
        theme_color: '#FAF9F5',
        background_color: '#FAF9F5',
        display: 'standalone',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        globIgnores: [
          '**/*.wasm',
          'offline-packs/shards/**',
          'offline-packs/search-manifest.json',
        ],
        runtimeCaching: [
          {
            urlPattern: /\/offline-packs\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mindmap-offline-packs-v8',
              expiration: {
                maxEntries: 52,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
  worker: {
    format: 'es',
  },
  esbuild: {
    drop: ['debugger'],
    pure: ['console.debug', 'console.trace'],
    legalComments: 'none',
  },
  build: {
    target: 'es2022',
    emptyOutDir: true,
    minify: 'esbuild',
    cssMinify: true,
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react'],
          search: ['rbush'],
          collab: ['yjs', 'y-indexeddb', 'dexie'],
          export: ['jspdf'],
        },
      },
    },
  },
});
