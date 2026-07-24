import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MAX_LIMIT } from '../links-query.service.js';

/**
 * Validated query parameters for `GET /links`. Query strings always arrive as
 * raw strings, so `@Transform` coerces `page`/`limit` to integers and `read`
 * to a boolean before validation. Malformed input (e.g. `?page=abc`) or
 * out-of-range values are rejected with a `400 Bad Request` by the global
 * `ValidationPipe` instead of flowing into Prisma as `NaN` and surfacing as an
 * uncaught `500`. Omitted `page`/`limit` stay `undefined` so
 * `LinksQueryService` applies its own defaults (page 1, limit 10).
 */
export class ListLinksQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  read?: boolean;

  @Transform(({ value }) =>
    value === undefined ? undefined : Number.parseInt(String(value), 10),
  )
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Transform(({ value }) =>
    value === undefined ? undefined : Number.parseInt(String(value), 10),
  )
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  @IsOptional()
  limit?: number;
}
