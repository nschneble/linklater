import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

/** Request body for POST /auth/forgot-password */
export class ForgotPasswordDto {
  @ApiProperty({
    description:
      'The email address associated with the account. A reset link will be sent here if the account exists.',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;
}
