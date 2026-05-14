import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/** Request body for POST /auth/2fa/sms/verify */
export class SmsVerifySetupDto {
  @ApiProperty({
    description: 'The 6-digit verification code sent via SMS.',
    example: '123456',
  })
  @IsString()
  @Length(6, 6)
  code: string;
}
