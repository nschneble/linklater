import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/** Request body for POST /auth/2fa/sms/setup */
export class SmsSetupDto {
  @ApiProperty({
    description: 'The phone number to enroll in E.164 format.',
    example: '+15555550100',
  })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'Phone number must be in E.164 format (e.g. +15555550100)',
  })
  phoneNumber: string;
}
