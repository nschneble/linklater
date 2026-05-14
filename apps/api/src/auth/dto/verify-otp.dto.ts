import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Short-lived MFA challenge token from POST /auth/login.',
  })
  @IsString()
  mfaToken: string;

  @ApiProperty({ description: '6-digit OTP code or a recovery code.' })
  @IsString()
  code: string;

  @ApiProperty({ enum: ['totp', 'sms', 'recovery'] })
  @IsIn(['totp', 'sms', 'recovery'])
  method: 'totp' | 'sms' | 'recovery';
}
