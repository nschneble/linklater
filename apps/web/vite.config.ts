/// <reference types="vite/client" />

import { defineConfig } from 'vitest/config';
import mkcert from 'vite-plugin-mkcert';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const isTest = process.env['VITEST'] === 'true' || process.env['NODE_ENV'] === 'test';

// https://vite.dev/config/
export default defineConfig({
  plugins: [!isTest && mkcert(), react(), tailwindcss()],
  test: {
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      provider: 'istanbul',
    },
    environment: 'jsdom',
    globals: true,
    setupFiles: './test/setup.ts',
  },
});
