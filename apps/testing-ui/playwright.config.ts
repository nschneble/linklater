/**
 * Shared Playwright runtime config. The harness owns its own runner (we use
 * the `playwright` library, not `@playwright/test`), so this file exports a
 * plain object that `runStory` reads when launching a browser. Centralised so
 * viewport, base URL, and timeout drift in one place.
 */
export interface HarnessConfig {
  baseUrl: string;
  viewport: { width: number; height: number };
  defaultTimeoutMs: number;
  navigationTimeoutMs: number;
}

const config: HarnessConfig = {
  baseUrl: process.env.LINKLATER_BASE_URL ?? 'https://localhost:5173',
  viewport: { width: 1280, height: 800 },
  defaultTimeoutMs: 10_000,
  navigationTimeoutMs: 15_000,
};

export default config;
