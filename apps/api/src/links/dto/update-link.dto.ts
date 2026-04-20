import { IsOptional, IsString } from 'class-validator';

export class UpdateLinkDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
