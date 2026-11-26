import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_APP_DIR = path.resolve(__dirname, '..');

export default defineConfig({
  root: __dirname,
  base: '/',
  publicDir: path.resolve(__dirname, 'public'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@app': path.resolve(ROOT_APP_DIR, 'src'),
    },
  },
  server: {
    port: 5174,
    fs: {
      allow: [__dirname, ROOT_APP_DIR],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4173',
        changeOrigin: false,
      },
      '/offline-packs': {
        target: 'http://127.0.0.1:4173',
        changeOrigin: false,
      },
    },
  },
  worker: {
    format: 'es',
  },
  esbuild: {
    drop: ['debugger'],
    legalComments: 'none',
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2022',
    minify: 'esbuild',
    cssMinify: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1100,
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
