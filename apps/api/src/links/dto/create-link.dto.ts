import { IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsPublicUrl } from '../../common/is-public-url.validator.js';

/** Request body for POST /links. */
export class CreateLinkDto {
  @ApiProperty({
    description:
      'The fully qualified URL to save. Must include the protocol (e.g. "https://").',
    example: 'http://www.stilldrinking.org/programming-sucks',
  })
  @IsUrl(
    {
      require_tld: true,
      require_protocol: true,
      protocols: ['http', 'https'],
      disallow_auth: true,
    },
    { message: 'Url must be a valid url' },
  )
  @IsPublicUrl()
  url: string;
}
