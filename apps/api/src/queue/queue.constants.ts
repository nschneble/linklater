/**
 * Dependency injection token for the pg-boss instance. Using a Symbol rather
 * than a string prevents accidental collisions with other providers.
 */
export const PGBOSS_INSTANCE = Symbol('PGBOSS_INSTANCE');

/**
 * Names of all pg-boss queues used in the application. Centralizing them here
 * prevents typos and makes it easy to see all background jobs at a glance.
 *
 * When adding a new queue, add its name here and implement a corresponding
 * worker in an `OnModuleInit` hook (see `MetadataService` for an example).
 */
export const QUEUES = {
  /** Scheduled job that deletes read links older than seven days. Runs at 03:00 UTC daily. */
  READ_LINK_CLEANUP: 'read-link-cleanup',
  /** Worker job that fetches and stores Open Graph metadata for a newly saved link. */
  METADATA_FETCH: 'metadata-fetch',
  /**
   * Worker job that sends a transactional auth email (verification, password
   * reset, email-change, magic-link, account-deletion). Enqueued off the
   * request thread so a slow or unavailable SMTP relay never 503s an auth
   * flow; the worker retries transient SMTP failures.
   */
  EMAIL_SEND: 'email-send',
} as const;
