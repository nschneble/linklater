import { ApiProperty } from '@nestjs/swagger';

/**
 * Response shape for POST /links/stumble. `url` is the destination of the
 * random unread link that was selected and atomically marked read. When the
 * unread list is empty the response is `{ url: null }` rather than a 404.
 */
export class StumbleResponseDto {
  @ApiProperty({
    example: 'http://www.stilldrinking.org/programming-sucks',
    description: 'The URL of the stumbled-upon link, or null.',
    nullable: true,
  })
  url: string | null;
}
