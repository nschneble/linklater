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

/**
 * Builds a `@Transform` callback that coerces a raw integer query-string value
 * before validation. Query parameters always arrive as strings, so a present
 * value is parsed with `Number.parseInt`; a malformed value (e.g. `?page=abc`)
 * becomes `NaN` so a following `@IsInt()` rejects it with a `400 Bad Request`
 * instead of flowing downstream. An absent value resolves to `defaultValue`,
 * which lets each caller pick its own omission behavior: pass nothing to leave
 * the field `undefined` (so `@IsOptional()`/service defaults apply, as on
 * `page`/`limit`) or pass a concrete fallback (as `count` does with
 * `DEFAULT_COUNT`). Shared across the integer query parameters so their
 * coercion can never drift.
 */
export function toOptionalInteger(
  defaultValue?: number,
): (parameters: TransformFnParams) => unknown {
  return ({ value }: TransformFnParams): unknown => {
    if (value === undefined) return defaultValue;
    return Number.parseInt(String(value), 10);
  };
}
