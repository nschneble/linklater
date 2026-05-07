import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VALID_MODES, VALID_THEMES } from '../users.constants.js';

/** Request body for PATCH /users/me. All fields are optional. */
export class UpdateMeDto {
  @ApiPropertyOptional({
    description:
      'A new password. Must be at least 12 characters. Requires `currentPassword` to also be provided.',
    example: 'new-super-secret-passphrase',
    minLength: 12,
  })
  @IsOptional()
  @IsString()
  @MinLength(12)
  password?: string;

  @ApiPropertyOptional({
    description:
      "The user's current password. Required when changing the password.",
    example: 'old-super-secret-passphrase',
  })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiPropertyOptional({
    description:
      'The theme to apply. Must be one of the supported theme identifiers.',
    example: 'scanner-darkly',
    enum: VALID_THEMES,
  })
  @IsOptional()
  @IsIn([...VALID_THEMES])
  theme?: string;

  @ApiPropertyOptional({
    description: 'The color mode to apply.',
    example: 'dark',
    enum: VALID_MODES,
  })
  @IsOptional()
  @IsIn([...VALID_MODES])
  mode?: string;
}
