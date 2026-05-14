import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { E164_REGEX } from '../../common/phone.constants.js';

/** Request body for POST /auth/2fa/sms/setup */
export class SmsSetupDto {
  @ApiProperty({
    description: 'The phone number to enroll in E.164 format.',
    example: '+15555550100',
  })
  @IsString()
  @Matches(E164_REGEX, {
    message: 'Phone number must be in E.164 format (e.g. +15555550100)',
  })
  phoneNumber: string;
}
