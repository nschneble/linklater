import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MAX_LIMIT } from '../links-query.service.js';
import { toOptionalBoolean, toOptionalInteger } from '../../common/index.js';
import { Transform } from 'class-transformer';

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

  @Transform(toOptionalBoolean)
  @IsBoolean()
  @IsOptional()
  read?: boolean;

  @Transform(toOptionalInteger())
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Transform(toOptionalInteger())
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  @IsOptional()
  limit?: number;
}
