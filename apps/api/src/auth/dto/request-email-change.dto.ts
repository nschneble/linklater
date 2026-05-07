import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Request body for POST /auth/request-email-change. */
export class RequestEmailChangeDto {
  @ApiProperty({
    description:
      'The new email address the user wants to switch to. A verification link will be sent there.',
    example: 'jane-new@example.com',
  })
  @IsEmail()
  email: string;
}
