import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Body for `POST /auth/account-deletion/confirm`. The raw token is the
 * value embedded in the confirmation email link's `?token=` query string.
 */
export class ConfirmAccountDeletionDto {
  @ApiProperty({
    description: 'The raw confirmation token from the email link.',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
