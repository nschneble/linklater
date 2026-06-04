import { defineConfig } from 'tuffgal';
import {
  resetTestDatabase,
  userWithLinksFixture,
  userWithReadHistoryFixture,
} from './tuffgal/database.ts';

export default defineConfig({
  paths: {
    actions: 'tuffgal/actions',
    stories: 'tuffgal/stories',
    baselines: 'tuffgal/baselines',
    report: 'tuffgal/report',
    authState: 'tuffgal/.auth',
  },

  baseUrl: process.env.LINKLATER_BASE_URL ?? 'https://localhost:5173',
  apiHost: 'https://localhost:3000',
  storageStatePins: ['linklater_token', 'linklater_refresh_token', 'linklater_mode', 'linklater_theme'],

  viewport: { width: 1280, height: 800 },
  defaultTimeoutMs: 10_000,
  navigationTimeoutMs: 15_000,
  frozenTime: '2026-01-15T12:00:00.000Z',

  database: {
    reset: resetTestDatabase,
    fixtures: {
      'user-with-3-links': userWithLinksFixture,
      'user-with-read-history': userWithReadHistoryFixture,
    },
  },

  devServers: {
    command: 'npm run dev:test',
    healthCheck: [
      { url: 'https://localhost:3000', timeoutMs: 120_000 },
      { url: 'https://localhost:5173', timeoutMs: 120_000 },
    ],
  },

  flowInventory: 'local/tuffgal/stories.md',
});
