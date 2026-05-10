/**
 * Maximum number of characters to store for a link description.
 * Enforced by slicing `rawDescription` before upsert. Keeps the `Meta` row
 * size predictable and prevents very long descriptions from bloating the table.
 */
export const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Maximum number of characters to store for any URL field (favicon, image).
 * Enforced by slicing resolved URLs before upsert. Some OG images have very
 * long data URIs or query strings; this cap prevents column overflow.
 */
export const MAX_URL_LENGTH = 2000;
