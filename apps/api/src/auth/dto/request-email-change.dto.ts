import { IsEmail } from 'class-validator';

export class RequestEmailChangeDto {
  @IsEmail()
  email: string;
}
