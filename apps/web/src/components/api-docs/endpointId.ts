/**
 * Deterministic, collision-free identifiers for one API endpoint, derived from
 * its method + path. Shared by the endpoint nav, the detail region, the URL
 * hash deep-link, and every field id the "try it out" form builds – so all
 * four agree on a single stable slug per endpoint and never drift.
 *
 * `endpointSlug` is the bare slug ("get-links") used as the URL hash and the
 * nav/detail correspondence key. `endpointHeadingId` prefixes it
 * ("endpoint-get-links") for the detail heading's DOM id (the deterministic
 * root `useRequestForm` derives field ids from, and the `aria-labelledby`
 * target of the detail region).
 */

/** Bare slug for an endpoint, e.g. `get-links`, `delete-links-id`. */
export function endpointSlug(method: string, path: string): string {
  return `${method}-${path}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** DOM id for an endpoint's detail heading, e.g. `endpoint-get-links`. */
export function endpointHeadingId(method: string, path: string): string {
  return `endpoint-${endpointSlug(method, path)}`;
}
