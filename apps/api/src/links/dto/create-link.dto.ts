import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateLinkDto {
  @IsUrl({}, { message: 'url must be a valid URL' })
  url: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
