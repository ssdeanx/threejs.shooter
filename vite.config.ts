import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// In ESM Vite config, import.meta.url is available; construct a dirname.
// Use a small helper to avoid TS complaining about URL type.
const DIRNAME = new URL('.', import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(DIRNAME, 'src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
  optimizeDeps: {
    include: ['three'],
  },
});