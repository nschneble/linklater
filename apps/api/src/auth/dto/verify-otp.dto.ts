import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Short-lived MFA challenge token from POST /auth/login.',
  })
  @IsString()
  mfaToken: string;

  @ApiProperty({
    description:
      '6-digit OTP or SMS code, or a 17-character recovery code (xxxxx-xxxxx-xxxxx).',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(17)
  code: string;

  @ApiProperty({ enum: ['totp', 'sms', 'recovery'] })
  @IsIn(['totp', 'sms', 'recovery'])
  method: 'totp' | 'sms' | 'recovery';
}
