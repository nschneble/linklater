import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/** Request body for POST /auth/mfa/email/verify */
export class EmailMultiFactorVerifyDto {
  @ApiProperty({
    description: "The 6-digit verification code sent to the user's email.",
    example: '123456',
  })
  @IsString()
  @Length(6, 6)
  code: string;
}
