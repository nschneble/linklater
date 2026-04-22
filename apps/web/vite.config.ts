/// <reference types="vite/client" />

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
