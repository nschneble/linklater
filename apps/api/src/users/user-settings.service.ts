import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { assertValidCustomTheme } from './custom-theme.js';
import * as bcrypt from 'bcryptjs';
import { Prisma, PrismaService } from '../prisma/index.js';
import { VALID_MODES, VALID_THEMES } from './users.constants.js';
import { withoutPasswordHash } from './users.utils.js';

export { VALID_MODES, VALID_THEMES };

/**
 * Inputs accepted by `UserSettingsService.updateMe`. All fields are optional;
 * only provided keys are written to the database.
 */
export interface UpdateMeInput {
  /** Toggles the color-vision-deficient mode flag. */
  cvdMode?: boolean;
  /** Toggles the dyslexia-friendly font flag. */
  dyslexicFont?: boolean;
  /**
   * The user's editable Custom theme: a per-mode map of bundle token names to
   * CSS color strings. Persisted verbatim to the `customTheme` JSON column.
   */
  customTheme?: CustomTheme;
  /** Whether the Custom theme is shown in the theme picker. */
  customThemeEnabled?: boolean;
  /** New password (plaintext) to hash and store. Requires `currentPassword`. */
  password?: string;
  /** Existing password used to authorize a password change. */
  currentPassword?: string;
  /** Theme identifier from the `VALID_THEMES` allow-list. */
  theme?: string;
  /** Color mode identifier from the `VALID_MODES` allow-list. */
  mode?: string;
}

/**
 * A user's editable Custom theme as stored in the `customTheme` JSON column: a
 * per-mode map of bundle token names (e.g. `--mount-border`) to CSS color
 * strings. Both modes are optional. The exact token set is enforced
 * client-side, so this stays a free-form record.
 */
export interface CustomTheme {
  dark?: Record<string, string>;
  light?: Record<string, string>;
}

/**
 * Writes the settings a user edits about their own account: theme, color mode,
 * accessibility flags, the Custom theme palette, and a password change. These
 * rules answer to the settings form rather than to the account record, which is
 * why they sit apart from `UsersService`.
 */
@Injectable()
export class UserSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Updates the current user's account settings. Any combination of
   * `password`, `theme`, `mode`, `cvdMode`, `dyslexicFont`, and `customTheme`
   * may be changed in a single call.
   *
   * Changing the password requires `currentPassword` for verification.
   * Theme and mode values are validated against their respective allow-lists.
   *
   * @param id - The UUID of the user to update.
   * @param data - The fields to update (all optional).
   * @returns The updated user without the password hash.
   * @throws {BadRequestException} When `currentPassword` is missing, the theme or mode is invalid.
   * @throws {NotFoundException} When no user exists with the given ID.
   * @throws {UnauthorizedException} When `currentPassword` does not match the stored hash.
   */
  async updateMe(id: string, data: UpdateMeInput) {
    const updateData: {
      cvdMode?: boolean;
      dyslexicFont?: boolean;
      customTheme?: Prisma.InputJsonValue;
      customThemeEnabled?: boolean;
      passwordHash?: string;
      theme?: string;
      mode?: string;
    } = {};

    if (data.password) {
      if (!data.currentPassword) {
        throw new BadRequestException(
          'Current password is required to set a new password',
        );
      }
      const user = await this.prisma.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundException('User not found');
      if (!user.passwordHash) {
        throw new BadRequestException(
          'Use the set-password endpoint to add a password to a passwordless account',
        );
      }
      const isValid = await bcrypt.compare(
        data.currentPassword,
        user.passwordHash,
      );
      if (!isValid)
        throw new UnauthorizedException('Current password is incorrect');
      const passwordHash = await bcrypt.hash(data.password, 12);
      updateData.passwordHash = passwordHash;
    }

    if (data.theme !== undefined) {
      if (!(VALID_THEMES as readonly string[]).includes(data.theme)) {
        throw new BadRequestException('Invalid theme');
      }
      updateData.theme = data.theme;
    }

    if (data.mode !== undefined) {
      if (!(VALID_MODES as readonly string[]).includes(data.mode)) {
        throw new BadRequestException('Invalid mode');
      }
      updateData.mode = data.mode;
    }

    if (data.cvdMode !== undefined) {
      updateData.cvdMode = data.cvdMode;
    }

    if (data.dyslexicFont !== undefined) {
      updateData.dyslexicFont = data.dyslexicFont;
    }

    if (data.customTheme !== undefined) {
      // defense-in-depth: reject oversized blobs or unknown token keys
      assertValidCustomTheme(data.customTheme);
      // DTO's named keys lack the index signature InputJsonValue needs
      updateData.customTheme = data.customTheme as Prisma.InputJsonValue;
    }

    if (data.customThemeEnabled !== undefined) {
      updateData.customThemeEnabled = data.customThemeEnabled;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    return withoutPasswordHash(user);
  }
}
