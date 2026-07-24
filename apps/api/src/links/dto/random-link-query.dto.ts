import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Validated query parameters for `GET /links/random`. `read` arrives as a raw
 * string and is coerced to a boolean before validation; a non-boolean value is
 * rejected with a `400 Bad Request`. When omitted, `read` stays `undefined` so
 * `LinksQueryService.getRandom` applies its default (unread links).
 */
export class RandomLinkQueryDto {
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  read?: boolean;
}
