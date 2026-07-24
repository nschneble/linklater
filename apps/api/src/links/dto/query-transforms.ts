import type { TransformFnParams } from 'class-transformer';

/**
 * Coerces a raw `read` query-string value to a boolean before validation.
 * Query parameters always arrive as strings, so the literal `'true'`/`'false'`
 * map to their boolean; any other value passes through unchanged so a following
 * `@IsBoolean()` rejects it with a `400 Bad Request`. Shared by the `read`
 * param on `GET /links` and `GET /links/random` so their coercion can never
 * drift.
 */
export function toOptionalBoolean({ value }: TransformFnParams): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}
