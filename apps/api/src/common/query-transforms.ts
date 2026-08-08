import type { TransformFnParams } from 'class-transformer';

// an unrecognized value passes through untouched, so the validator that
// follows rejects it instead of silently reading as false
export function toOptionalBoolean({ value }: TransformFnParams): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

// a malformed value becomes NaN on purpose, so the validator that follows
// rejects it rather than letting it flow downstream. omitting the default
// leaves the field undefined for an optional parameter to handle
export function toOptionalInteger(
  defaultValue?: number,
): (parameters: TransformFnParams) => unknown {
  return ({ value }: TransformFnParams): unknown => {
    if (value === undefined) return defaultValue;
    return Number.parseInt(String(value), 10);
  };
}
