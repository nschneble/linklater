/**
 * Reads the environment variable `name`, returning its value when set and
 * non-empty, or throwing `${name} must be set` when it is missing or blank.
 *
 * Replaces the repeated `if (!process.env.X) throw new Error('X must be set')`
 * guard and the silent `process.env.X!` assertion, which would otherwise feed
 * the literal string `undefined` into a URL or secret when a variable is unset.
 * Distinct from `validateRequiredEnvVars`, which fails the whole process at
 * startup; this validates a single variable lazily at its point of use.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
}
