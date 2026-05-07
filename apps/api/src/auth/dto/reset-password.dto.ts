import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Request body for POST /auth/reset-password. */
export class ResetPasswordDto {
  @ApiProperty({
    description:
      'The one-time reset token delivered via the password reset email.',
    example: 'a3f9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'The new password. Must be at least 12 characters.',
    example: 'new-super-secret-passphrase',
    minLength: 12,
  })
  @IsString()
  @MinLength(12)
  password: string;
}
