import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

/** Request body for POST /auth/request-email-change */
export class RequestEmailChangeDto {
  @ApiProperty({
    description:
      'The new email address the user wants to switch to, and where a verification link will be sent.',
    example: 'new.email@example.com',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description:
      'Valid TOTP or SMS OTP, or a recovery code (xxxxx-xxxxx-xxxxx) — required when 2FA is enabled.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$|^[^01IOl]{5}-[^01IOl]{5}-[^01IOl]{5}$/, {
    message:
      'code must be a 6-digit OTP or a recovery code in the format xxxxx-xxxxx-xxxxx',
  })
  code?: string;
}
