import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class Disable2faDto {
  @ApiPropertyOptional({ description: 'Current password for local accounts.' })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiPropertyOptional({
    description:
      'Valid TOTP or email OTP, or a recovery code (xxxxx-xxxxx-xxxxx).',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$|^[^01IOl]{5}-[^01IOl]{5}-[^01IOl]{5}$/, {
    message:
      'code must be a 6-digit OTP or a recovery code in the format xxxxx-xxxxx-xxxxx',
  })
  code?: string;
}
