import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Request body for POST /auth/forgot-password. */
export class ForgotPasswordDto {
  @ApiProperty({
    description:
      'The email address associated with the account. A reset link will be sent here if the account exists.',
    example: 'jane@example.com',
  })
  @IsEmail()
  email: string;
}
