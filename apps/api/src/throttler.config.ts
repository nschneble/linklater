/**
 * Global rate-limit configuration for the app, consumed by
 * `ThrottlerModule.forRoot` in `app.module.ts`.
 *
 * `@nestjs/throttler` v6 evaluates every throttler declared here against every
 * guarded route, applying each one's limit (a route that gives no override for
 * a given throttler falls back to that throttler's module default). With more
 * than one named throttler a route therefore binds the union of all of them,
 * and the tightest bucket trips first, even for a route that only meant to set
 * its own single limit.
 *
 * To give each route exactly one limit, the module declares a single throttler
 * named 'default'. Every rate-limited route then sets its own ceiling with
 * `@Throttle({ default: { ttl, limit } })`, which overrides this one bucket for
 * that route. Because there is only one bucket no union can form, so the route
 * enforces precisely its declared limit. `throttler.config.spec.ts` boots the
 * real guard against this config and the real controllers to prove it.
 *
 * The values below are only a fallback for a guarded route that carries no
 * `@Throttle` of its own. Every route guarded by `CustomThrottlerGuard` today
 * declares an explicit `@Throttle`, so this baseline is a safety net rather
 * than an active limit. It is a generous per-minute ceiling (60 / minute) so a
 * route that is guarded but accidentally left un-decorated still cannot be hit
 * without bound.
 */
export interface ThrottlerConfig {
  name: string;
  ttl: number;
  limit: number;
}

export const THROTTLER_CONFIG: ThrottlerConfig[] = [
  { name: 'default', ttl: 60000, limit: 60 },
];
