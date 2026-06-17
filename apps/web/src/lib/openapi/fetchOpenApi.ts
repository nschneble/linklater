import { parseOpenApi } from './parseOpenApi';
import type { NormalizedApi } from './types';
import type { OpenAPIV3 } from 'openapi-types';

/** Path the API serves its OpenAPI document at (see `apps/api/src/main.ts`). */
const OPENAPI_PATH = '/openapi.json';

/** Injectable fetch, so tests can supply a stub without a global mock. */
type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
}>;

/**
 * Builds the spec URL the same way `ApiDocsView` does: an absolute
 * `VITE_API_BASE_URL` is prefixed onto `/openapi.json`; an unset base falls
 * back to the relative path (same origin behind a proxy).
 */
export function resolveOpenApiUrl(apiBaseUrl: string | undefined): string {
  if (!apiBaseUrl) return OPENAPI_PATH;
  return `${apiBaseUrl}${OPENAPI_PATH}`;
}

/**
 * Derives the API origin the "try it" affordance should target by stripping
 * the `/openapi.json` suffix — mirrors `useScalarConfiguration`. An absolute
 * spec URL resolves to the API origin; a relative one resolves to '' (same
 * origin), which is correct behind a reverse proxy.
 */
export function resolveServerOrigin(openapiUrl: string): string {
  return openapiUrl.replace(/\/openapi\.json$/, '');
}

/**
 * Fetches the OpenAPI document from `openapiUrl`, normalizes it, and attaches
 * the derived server origin. Throws on a non-2xx response so the UI can show
 * an error state.
 *
 * @param openapiUrl Fully-resolved spec URL (see {@link resolveOpenApiUrl}).
 * @param fetchImplementation Injectable fetch; defaults to the global.
 */
export async function fetchOpenApi(
  openapiUrl: string,
  fetchImplementation: FetchLike = fetch,
): Promise<NormalizedApi> {
  const response = await fetchImplementation(openapiUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to load the API specification (HTTP ${response.status ?? 0}).`,
    );
  }
  const document = (await response.json()) as OpenAPIV3.Document;
  return parseOpenApi(document, resolveServerOrigin(openapiUrl));
}
