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
  // `linklater_token` is a JWT — its `exp` claim is set at login and is
  // not renewed by pin/restore. Storage state cached across runs older
  // than the access-token TTL will hydrate an expired JWT, and the first
  // authenticated request will 401. `resetTestDatabase` wipes
  // `tuffgal/.auth` on every reset which covers the common path; do not
  // reuse a longer-lived CI cache of this directory beyond JWT exp.
  storageStatePins: ['linklater_token', 'linklater_refresh_token', 'linklater_mode', 'linklater_theme'],

  breakpoints: { 'mobile', 'desktop' },
  defaultTimeoutMs: 10_000,
  navigationTimeoutMs: 60_000,
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
