import { IsUrl } from 'class-validator';

export class CreateLinkDto {
  @IsUrl({}, { message: 'url must be a valid url' })
  url: string;
}
