import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Request body for POST /auth/register. */
export class RegisterDto {
  @ApiProperty({
    description: 'The email address the new account will be associated with.',
    example: 'jane@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'A strong password. Must be at least 12 characters.',
    example: 'super-secret-passphrase',
    minLength: 12,
  })
  @IsString()
  @MinLength(12)
  password: string;
}
