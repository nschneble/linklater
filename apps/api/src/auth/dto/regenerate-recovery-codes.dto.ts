import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RegenerateRecoveryCodesDto {
  @ApiPropertyOptional({ description: 'Current password for local accounts.' })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiPropertyOptional({ description: 'Valid TOTP or SMS OTP for re-authentication.' })
  @IsOptional()
  @IsString()
  code?: string;
}
