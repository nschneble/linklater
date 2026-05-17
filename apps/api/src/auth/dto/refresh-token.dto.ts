import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Request body for `POST /auth/refresh`. The refresh token is the raw
 * (un-hashed) token returned at login or at the end of any previous
 * refresh. Each token can only be used once — presenting it here deletes
 * it and returns a new rotated pair.
 */
export class RefreshTokenDto {
  @ApiProperty({
    description:
      'The raw refresh token previously returned by login, magic link' +
      ' verification, or a prior refresh. Consumed on use — a new token' +
      ' is returned with every successful refresh.',
    example: 'a3f8c...64-character-hex-string...d91e',
  })
  @IsString()
  @MinLength(1)
  refreshToken: string;
}
