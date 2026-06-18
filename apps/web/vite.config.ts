/// <reference types="vite/client" />

import { defineConfig } from 'vitest/config';
import mkcert from 'vite-plugin-mkcert';
import os from 'node:os';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const isTest =
  process.env['VITEST'] === 'true' || process.env['NODE_ENV'] === 'test';

const bareHostname = os.hostname().replace(/\.local$/i, '');
const mkcertHosts = ['localhost', `${bareHostname}.local`];

// https://vite.dev/config/
export default defineConfig({
  build: {
    // ApiDocsView is route-lazy (React.lazy, loads only on /docs).
    // The chunk is intentionally large because it bundles the full OpenAPI
    // renderer; raising the limit silences the warning without hiding real bloat.
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.names.some((name) => name.endsWith('.css'))) {
            return 'assets/css/[name]-[hash][extname]';
          }

          return 'assets/[name]-[hash][extname]';
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
  },
  plugins: [!isTest && mkcert({ hosts: mkcertHosts }), react(), tailwindcss()],
  server: {
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false,
        target: 'https://localhost:3000',
      },
    },
  },
  test: {
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      provider: 'istanbul',
    },
    environment: 'jsdom',
    globals: true,
    reporters: ['default', './test/failed-files-reporter.ts'],
    setupFiles: './test/setup.ts',
  },
});
