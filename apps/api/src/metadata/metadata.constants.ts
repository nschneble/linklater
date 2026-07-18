import type { SendOptions } from 'pg-boss';

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

/**
 * Maximum bytes to read from a remote HTML response before aborting.
 * Protects the metadata worker from hostile or accidentally massive bodies
 * that would otherwise be buffered entirely into memory.
 */
export const MAX_HTML_BYTES = 5 * 1024 * 1024;

/**
 * Number of metadata-fetch jobs the worker processes concurrently
 * (pg-boss `localConcurrency`). Each fetch is I/O-bound and can block for up
 * to the fetch timeout, so a strictly serial worker lets one slow or hung site
 * stall metadata for every other queued link. Five independent local workers
 * keep a single slow site from blocking the others.
 *
 * Connection budget: this stays well within the pool caps documented in
 * docs/DEPLOYMENT.md. pg-boss holds one of its 5 pooled connections only for
 * the brief dequeue/complete round-trips — not while a handler runs — so five
 * in-flight handlers do not pin five pg-boss connections. The per-fetch
 * database writes go through Prisma's separate pool (`connection_limit=10`).
 * Both pools sit comfortably under Postgres `max_connections = 50`.
 */
export const METADATA_WORKER_CONCURRENCY = 5;

/**
 * Retry policy for enqueued metadata-fetch jobs. The handler already swallows
 * fetch/parse failures and records `fetchedAt` (idempotent) so polling clients
 * stop, meaning these retries only fire when the handler itself throws — for
 * example when the database is briefly unreachable mid-write. Three attempts
 * with exponential backoff starting at 30s, mirroring the email queue's policy.
 */
export const METADATA_SEND_OPTIONS: SendOptions = {
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
};
