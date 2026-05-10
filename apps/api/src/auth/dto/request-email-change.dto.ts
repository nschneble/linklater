import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/** Request body for POST /auth/request-email-change */
export class RequestEmailChangeDto {
  @ApiProperty({
    description:
      'The new email address the user wants to switch to, and where a verification link will be sent.',
    example: 'new.email@example.com',
  })
  @IsEmail()
  email: string;
}
