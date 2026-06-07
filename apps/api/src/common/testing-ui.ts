/**
 * Single source of truth for the `TESTING_UI` env flag. The
 * tuffgal-driven `npm run dev:test` script sets `TESTING_UI=1`; any
 * service that needs to opt out of network calls, throttling, or external
 * I/O should branch off `isTestingUi()` rather than reading the env var
 * directly. Centralising the check keeps the bypass policy in one place
 * and makes it easy to add cross-cutting guards (e.g. forbid
 * TESTING_UI=1 in production).
 */
export function isTestingUi(): boolean {
  return process.env.TESTING_UI === '1';
}
