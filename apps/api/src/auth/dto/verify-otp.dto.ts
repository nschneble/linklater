import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsJWT, IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Short-lived MFA challenge token from POST /auth/login.',
  })
  @IsJWT()
  mfaToken: string;

  @ApiProperty({
    description:
      '6-digit OTP or email code, or a 17-character recovery code (xxxxx-xxxxx-xxxxx).',
  })
  @IsString()
  @Matches(/^\d{6}$|^[^01IOl]{5}-[^01IOl]{5}-[^01IOl]{5}$/, {
    message:
      'code must be a 6-digit OTP or a recovery code in the format xxxxx-xxxxx-xxxxx',
  })
  code: string;

  @ApiProperty({ enum: ['totp', 'email', 'recovery'] })
  @IsIn(['totp', 'email', 'recovery'])
  method: 'totp' | 'email' | 'recovery';
}
