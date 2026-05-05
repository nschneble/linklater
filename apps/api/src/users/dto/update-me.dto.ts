import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { VALID_MODES, VALID_THEMES } from '../users.constants.js';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(12)
  password?: string;

  @IsOptional()
  @IsString()
  @MinLength(12)
  currentPassword?: string;

  @IsOptional()
  @IsIn([...VALID_THEMES])
  theme?: string;

  @IsOptional()
  @IsIn([...VALID_MODES])
  mode?: string;
}
