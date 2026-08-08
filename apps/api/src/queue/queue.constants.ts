import type { SendOptions } from 'pg-boss';

export const PGBOSS_INSTANCE = Symbol('PGBOSS_INSTANCE');

// without a retry, one transient blip skips the whole tick and nothing
// runs again until the next cron fire, which can be a day away
export const RECURRING_JOB_RETRY_OPTIONS: SendOptions = {
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
};

// a name here is dead without a worker started from a module init
// hook, the way the metadata service does it
export const QUEUES = {
  READ_LINK_CLEANUP: 'read-link-cleanup',
  RSS_ENTRY_PRUNE: 'rss-entry-prune',
  METADATA_FETCH: 'metadata-fetch',
  /** Off the request thread, so a slow relay never 503s an auth flow. */
  EMAIL_SEND: 'email-send',
} as const;
