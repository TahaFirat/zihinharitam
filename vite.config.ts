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
      injectRegister: 'auto',
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
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        globIgnores: ['**/*.wasm'],
        runtimeCaching: [
          {
            urlPattern: /\/offline-packs\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mindmap-offline-packs-v4',
              expiration: {
                maxEntries: 40,
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
          search: ['minisearch', 'rbush'],
          collab: ['yjs', 'y-indexeddb', 'dexie'],
          export: ['jspdf'],
        },
      },
    },
  },
});
