import { defineConfig } from 'tuffgal';
import {
  resetTestDatabase,
  userWithLinksFixture,
  userWithReadHistoryFixture,
} from './tuffgal/database.ts';

export default defineConfig({
  apiHost: 'https://localhost:3000',
  baseUrl: process.env.LINKLATER_BASE_URL ?? 'https://localhost:5173',
  breakpoints: ['mobile', 'desktop'],
  colorScheme: 'dark',
  database: {
    fixtures: {
      'user-with-3-links': userWithLinksFixture,
      'user-with-read-history': userWithReadHistoryFixture,
    },
    reset: resetTestDatabase,
  },
  defaultTimeoutMs: 10_000,
  devServers: {
    command: 'npm run dev:test',
    healthCheck: [
      { url: 'https://localhost:3000', timeoutMs: 120_000 },
      { url: 'https://localhost:5173', timeoutMs: 120_000 },
    ],
  },
  frozenTime: '2026-01-15T12:00:00.000Z',
  interactiveMode: true,
  navigationTimeoutMs: 60_000,
  paths: {
    actions: 'tuffgal/actions',
    authState: 'tuffgal/.auth',
    baselines: 'tuffgal/baselines',
    report: 'tuffgal/report',
    stories: 'tuffgal/stories',
  },
  storageStatePins: [
    'linklater_mode',
    'linklater_refresh_token',
    'linklater_theme',
    'linklater_token',
  ],
});
