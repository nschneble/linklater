import { defineConfig, devices } from '@playwright/test';

const PREVIEW_URL = 'https://localhost:4173';

export default defineConfig({
  outputDir: 'test-results',
  projects: [
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { height: 852, width: 393 },
      },
    },
  ],
  reporter: 'list',
  testDir: 'browser',
  use: {
    baseURL: PREVIEW_URL,
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'vite build && vite preview --port 4173 --strictPort',
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 120_000,
    url: PREVIEW_URL,
  },
});
