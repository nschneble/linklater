import type { SendOptions } from 'pg-boss';

// keeps the metadata row a predictable size, so one long description
// cannot bloat the table
export const MAX_DESCRIPTION_LENGTH = 500;

// favicon and OG image URLs can carry very long data URIs or queries
export const MAX_URL_LENGTH = 2000;

// bounds what a hostile or huge response body can buffer into memory
export const MAX_HTML_BYTES = 5 * 1024 * 1024;

// a serial worker lets one hung site stall every other queued link;
// pg-boss holds a pooled connection only across dequeue and complete,
// so in-flight handlers do not pin one each; the pool caps in
// docs/DEPLOYMENT.md are the budget five sits under
export const METADATA_WORKER_CONCURRENCY = 5;

// the handler swallows fetch and parse failures itself, so a retry only
// fires when the handler throws, such as a write hitting a dead database
export const METADATA_SEND_OPTIONS: SendOptions = {
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
};
