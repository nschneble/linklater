import { IsBoolean, IsOptional } from 'class-validator';
import { toOptionalBoolean } from '../../common/index.js';
import { Transform } from 'class-transformer';

/**
 * Validated query parameters for `GET /links/random`. `read` arrives as a raw
 * string and is coerced to a boolean before validation; a non-boolean value is
 * rejected with a `400 Bad Request`. When omitted, `read` stays `undefined` so
 * `LinksQueryService.getRandom` applies its default (unread links).
 */
export class RandomLinkQueryDto {
  @Transform(toOptionalBoolean)
  @IsBoolean()
  @IsOptional()
  read?: boolean;
}
