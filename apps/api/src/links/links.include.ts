import { Prisma } from '../prisma/index.js';

/**
 * The `meta` relation to load on link reads/writes, minus `source`: the full
 * raw HTML of the fetched page (up to `MAX_HTML_BYTES`, 5 MB). `source` stays
 * in the database to back future reader-mode / reading-time / full-text
 * features, but is far too large to send over the wire on every link, so it is
 * omitted from every response payload.
 */
export const META_INCLUDE = {
  meta: { omit: { source: true } },
} satisfies Prisma.LinkInclude;
