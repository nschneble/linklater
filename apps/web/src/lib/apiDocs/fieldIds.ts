/**
 * Deterministic id helpers for the "try it out" request form.
 *
 * Field ids are derived from the endpoint's `headingId` (built once in
 * `EndpointCard` from method+path) plus the parameter's location and name –
 * NEVER from `useId` (CONSTRAINT E4). This keeps ids collision-free and stable
 * across every rendered endpoint and across re-renders, so `aria-describedby`
 * and label `htmlFor` references can never dangle or collide.
 */

/** Lowercase, hyphen-collapsed slug suitable for embedding in an id. */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `${headingId}-param-${location}-${slug(name)}`. */
export function buildFieldId(
  headingId: string,
  location: string,
  name: string,
): string {
  return `${headingId}-param-${location}-${slug(name)}`;
}

/** The id of a field's inline error node: `${fieldId}-error`. */
export function fieldErrorId(fieldId: string): string {
  return `${fieldId}-error`;
}

/** The id of a field's description node: `${fieldId}-desc`. */
export function fieldDescriptionId(fieldId: string): string {
  return `${fieldId}-desc`;
}

/** The stable id of the request-body textarea field: `${headingId}-body`. */
export function describeBodyFieldId(headingId: string): string {
  return `${headingId}-body`;
}
