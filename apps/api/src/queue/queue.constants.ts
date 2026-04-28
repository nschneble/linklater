export const PGBOSS_INSTANCE = Symbol('PGBOSS_INSTANCE');

export const QUEUES = {
  ARCHIVE_CLEANUP: 'archive-cleanup',
  METADATA_FETCH: 'metadata-fetch',
} as const;
