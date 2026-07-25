import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { toOptionalInteger } from '../../links/dto/query-transforms.js';

/** Smallest number of suggestions a caller may request. */
export const MIN_COUNT = 1;

/** Largest number of suggestions a caller may request. */
export const MAX_COUNT = 5;

/** Number of suggestions returned when the caller omits `count`. */
export const DEFAULT_COUNT = 3;

/**
 * Validated query parameters for `GET /suggestions`. `count` arrives as a raw
 * string and is coerced to an integer before validation, defaulting to
 * {@link DEFAULT_COUNT} when omitted. Non-numeric or out-of-range values are
 * rejected with a `400 Bad Request` by the global `ValidationPipe`.
 */
export class SuggestionsQueryDto {
  @Transform(toOptionalInteger(DEFAULT_COUNT))
  @IsInt()
  @Min(MIN_COUNT)
  @Max(MAX_COUNT)
  count: number = DEFAULT_COUNT;
}
