import { IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Request body for POST /links. */
export class CreateLinkDto {
  @ApiProperty({
    description:
      'The fully-qualified URL to save. Must include the protocol (http:// or https://).',
    example: 'https://example.com/great-article',
  })
  @IsUrl({}, { message: 'url must be a valid url' })
  url: string;
}
