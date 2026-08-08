export interface ThrottlerConfig {
  name: string;
  ttl: number;
  limit: number;
}

// exactly one bucket by design: the guard evaluates every declared
// throttler against every guarded route and the tightest one trips first,
// so a second name here would silently cap routes that never asked for
// it. routes override this single bucket to set their own ceiling, and
// these numbers are only the fallback for a route that sets none
export const THROTTLER_CONFIG: ThrottlerConfig[] = [
  { name: 'default', ttl: 60000, limit: 60 },
];
