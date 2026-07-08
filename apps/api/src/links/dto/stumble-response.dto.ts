import { ApiProperty } from '@nestjs/swagger';

/**
 * Response shape for POST /links/stumble. `url` is the destination of the
 * random unread link that was selected and atomically marked read. When the
 * unread list is empty the response is `{ url: null }` rather than a 404.
 */
export class StumbleResponseDto {
  @ApiProperty({
    example: 'https://example.com/great-article',
    description:
      'The URL of the stumbled link. Null when there are no unread links.',
    nullable: true,
  })
  url: string | null;
}
