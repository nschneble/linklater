import { IsString, MinLength } from 'class-validator';

export class ExtensionTokenDto {
  @IsString()
  @MinLength(1)
  code: string;

  @IsString()
  @MinLength(1)
  codeVerifier: string;
}
