import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * Body for `DELETE /users/me`. Both fields are optional — the controller
 * forwards them to `AuthService.deleteAccount` which decides whether to
 * route through the credentialed re-auth path (password OR code) or the
 * email-confirmation path (neither field needed for magic-link-only
 * accounts).
 */
export class DeleteMeDto {
  @ApiPropertyOptional({ description: 'Current password for local accounts.' })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiPropertyOptional({
    description: 'Valid TOTP code, or a recovery code (xxxxx-xxxxx-xxxxx).',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$|^[^01IOl]{5}-[^01IOl]{5}-[^01IOl]{5}$/, {
    message:
      'code must be a 6-digit OTP or a recovery code in the format xxxxx-xxxxx-xxxxx',
  })
  code?: string;
}
