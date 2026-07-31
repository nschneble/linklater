import { ApiPropertyOptional } from '@nestjs/swagger';
import { LinkResponseDto } from './link-response.dto.js';

/**
 * Response shape for GET /links/random. Unlike `stumble`, the returned link
 * is not modified; it stays in its current read/unread state. When no link
 * matches the filter the response is `{ link: null }`.
 */
export class RandomLinkResponseDto {
  @ApiPropertyOptional({
    type: () => LinkResponseDto,
    nullable: true,
    description: 'A randomly chosen link, or null.',
  })
  link: LinkResponseDto | null;
}
