import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Request body for `POST /tokens`. The `name` is a user-provided label
 * that makes the token identifiable in the list (e.g. "Chrome Extension").
 */
export class CreateTokenDto {
  @ApiProperty({
    description:
      'A human-readable label for the token so the user can identify'
      + ' it in the token list.',
    example: 'Chrome Extension',
    maxLength: 100,
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}
