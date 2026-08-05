import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidatorConstraint,
  registerDecorator,
} from 'class-validator';
import { VALID_MODES, VALID_THEMES } from '../users.constants.js';
import type {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraintInterface,
} from 'class-validator';

/** True when `value` is a plain object (not null, not an array). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when `value` is a plain object whose every value is a string. */
function isStringRecord(value: unknown): boolean {
  if (!isPlainObject(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === 'string');
}

/**
 * Validates the shape of a user's Custom theme: an object with optional `dark`
 * and `light` keys, each a map of bundle token names (e.g. `--mount-border`) to
 * CSS color strings. Both modes are optional so a partial save is accepted.
 *
 * This decorator only guards the broad `{ dark?, light? }` string-map shape so
 * a malformed blob can never reach the JSON column. The exact token vocabulary
 * and a payload size cap are enforced separately, server-side, by
 * `assertValidCustomTheme` in `users/custom-theme.ts`.
 */
@ValidatorConstraint({ name: 'isCustomThemeShape', async: false })
class IsCustomThemeShapeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!isPlainObject(value)) {
      return false;
    }
    return (['dark', 'light'] as const).every((mode) => {
      const palette = value[mode];
      return palette === undefined || isStringRecord(palette);
    });
  }

  defaultMessage(validationArguments: ValidationArguments): string {
    return `${validationArguments.property} must be an object with optional 'dark' and 'light' maps of token names to color strings`;
  }
}

/** Property decorator applying the {@link IsCustomThemeShapeConstraint}. */
function IsCustomThemeShape(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCustomThemeShapeConstraint,
    });
  };
}

/**
 * A user's editable "Custom" theme: a per-mode map of bundle token names to CSS
 * color strings. Both modes are optional so a partial save (e.g. only the dark
 * palette) is accepted. Used for the OpenAPI schema and request typing; the
 * shape is validated by `@IsCustomThemeShape` on `UpdateMeDto.customTheme`.
 */
export class CustomThemeDto {
  @ApiPropertyOptional({
    description:
      'Dark-mode palette: a map of bundle token names (e.g. `--mount-border`) to CSS color strings.',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  dark?: Record<string, string>;

  @ApiPropertyOptional({
    description:
      'Light-mode palette: a map of bundle token names (e.g. `--mount-border`) to CSS color strings.',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  light?: Record<string, string>;
}

/** Request body for PATCH /users/me. All fields are optional. */
export class UpdateMeDto {
  @ApiPropertyOptional({
    description:
      'A new password. Must be at least 12 characters. Requires `currentPassword` to also be provided.',
    example: 'new-super-secret-passphrase',
    minLength: 12,
  })
  @IsOptional()
  @IsString()
  @MinLength(12)
  password?: string;

  @ApiPropertyOptional({
    description:
      "The user's current password. Required when changing the password.",
    example: 'old-super-secret-passphrase',
  })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiPropertyOptional({
    description:
      'The theme to apply. Must be one of the supported theme identifiers.',
    example: 'scanner-darkly',
    enum: VALID_THEMES,
  })
  @IsOptional()
  @IsIn([...VALID_THEMES])
  theme?: string;

  @ApiPropertyOptional({
    description: 'The color mode to apply.',
    example: 'dark',
    enum: VALID_MODES,
  })
  @IsOptional()
  @IsIn([...VALID_MODES])
  mode?: string;

  @ApiPropertyOptional({
    description:
      'When true, switches to the Apollo 10½ CVD-friendly theme and enables additional shape/icon accessibility enhancements.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  cvdMode?: boolean;

  @ApiPropertyOptional({
    description:
      'When true, renders the interface in a dyslexia-friendly typeface to improve reading accessibility.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  dyslexicFont?: boolean;

  @ApiPropertyOptional({
    description:
      "The user's editable Custom theme: a per-mode (`dark`/`light`) map of bundle token names to CSS color strings. Both modes are optional.",
    type: CustomThemeDto,
  })
  @IsOptional()
  @IsCustomThemeShape()
  customTheme?: CustomThemeDto;

  @ApiPropertyOptional({
    description:
      'Whether the Custom theme is shown in the theme picker. The Custom theme is always editable in the Theme Editor; this only controls its visibility in the picker menus.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  customThemeEnabled?: boolean;
}
