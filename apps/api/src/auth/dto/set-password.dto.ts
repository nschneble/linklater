import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Request body for `POST /auth/set-password`. Used by passwordless
 * accounts, those that signed up via Google/Apple SSO or a magic link
 * and have no password yet. Once a password is set, the account can log
 * in with email/password in addition to the original passwordless path.
 *
 * NOTE: This endpoint is only callable once per account. If the account
 * already has a password, the service throws a `BadRequestException`.
 */
export class SetPasswordDto {
  @ApiProperty({
    description:
      'The new password. Must be at least 12 characters long. No other' +
      ' complexity rules are enforced – length is the primary defense.',
    example: 'correct-horse-battery-staple',
    minLength: 12,
  })
  @IsString()
  @MinLength(12)
  password: string;
}
