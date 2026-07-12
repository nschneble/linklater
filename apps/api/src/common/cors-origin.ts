/**
 * Parses the `CORS_ORIGIN` environment variable into a value the `cors`
 * middleware understands.
 *
 * Production deployments need to allow more than one origin at once: the
 * front-end domain plus any browser-extension origins
 * (`chrome-extension://<id>`, `moz-extension://<id>`). The `cors` package
 * exact-matches a plain string, so a comma-separated value passed straight
 * through would never match any single origin. This helper turns a
 * comma-separated list into the `string[]` form `cors` matches per-entry,
 * while preserving the simpler shapes:
 *
 * - unset / empty  -> `'*'`  (open; bookmarklet posts from any site)
 * - single origin  -> the raw string (exact match)
 * - comma list     -> `string[]` (each entry exact-matched)
 *
 * Surrounding whitespace is trimmed and empty entries are dropped so a
 * trailing comma or padded list does not produce a phantom `''` origin
 * that can never match.
 *
 * @param raw - The raw `CORS_ORIGIN` value (typically `process.env.CORS_ORIGIN`).
 * @returns `'*'`, a single origin string, or an array of origin strings.
 */
export function parseCorsOrigin(raw: string | undefined): string | string[] {
  if (!raw) return '*';

  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) return '*';
  if (origins.length === 1) return origins[0];
  return origins;
}
