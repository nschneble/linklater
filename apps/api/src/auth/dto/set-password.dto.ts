import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Request body for `POST /auth/set-password`. Used by accounts that signed
 * up via Google or Apple SSO and have no password yet. Once a password is
 * set, the account can log in with email/password in addition to SSO.
 *
 * NOTE: This endpoint is only callable once per account. If the account
 * already has a password, the service throws a `BadRequestException`.
 */
export class SetPasswordDto {
  @ApiProperty({
    description:
      'The new password. Must be at least 12 characters long. No other' +
      ' complexity rules are enforced — length is the primary defense.',
    example: 'correct-horse-battery-staple',
    minLength: 12,
  })
  @IsString()
  @MinLength(12)
  password: string;
}
