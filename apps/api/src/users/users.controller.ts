import {
  Controller,
  Delete,
  Get,
  Inject,
  Patch,
  Body,
  Req,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from '../auth/auth.service.js';
import { CustomThrottlerGuard } from '../auth/custom-throttler.guard.js';
import { ThrottleMessage } from '../auth/throttle-message.decorator.js';
import { JwtAuthGuard, type AuthRequest } from '../auth/index.js';
import { DeleteMeDto } from './dto/delete-me.dto.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { UsersService } from './users.service.js';

/**
 * Endpoints for the authenticated user to read and manage their own account.
 * Every route requires a valid JWT – no user can access another user's data.
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  /**
   * Returns the current user's profile. Unlike `GET /auth/me`, this endpoint
   * includes all user fields and does not remap `id` to `userId`.
   */
  @ApiOperation({ summary: 'Get the current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile without passwordHash.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @Get('me')
  async getMe(@Req() request: AuthRequest) {
    return this.usersService.findById(request.user.userId);
  }

  /**
   * Updates the current user's account settings. Accepts any combination of
   * `password`, `theme`, `mode`, `cvdMode`, `dyslexicFont`, `customTheme`, and
   * `customThemeEnabled` – all fields are optional. Changing the password
   * requires `currentPassword` as well.
   */
  @ApiOperation({
    summary: 'Update account settings (password, theme, mode, custom theme)',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated user profile without passwordHash.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid input (e.g. wrong current password, unsupported theme).',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid JWT or incorrect current password.',
  })
  @Patch('me')
  async updateMe(@Req() request: AuthRequest, @Body() body: UpdateMeDto) {
    return this.usersService.updateMe(request.user.userId, body);
  }

  /**
   * Permanently deletes the current user's account and all associated
   * records. Step-up authenticated via `AuthService.deleteAccount`:
   *
   * - Accounts with a password or TOTP must supply `currentPassword` OR a
   *   `code` (TOTP / recovery). Wrong creds return 401; missing creds 400.
   * - Magic-link-only-no-MFA accounts have no inline credential to
   *   challenge – the service emails a confirmation link instead and
   *   returns `{ requiresEmailConfirmation: true }` without deleting.
   *
   * Rate-limited via the shared `auth-reauth` bucket (5 attempts / 15
   * minutes per IP) to match `disableMfa` / `regenerateRecoveryCodes`.
   */
  @ApiOperation({ summary: 'Permanently delete the current user account' })
  @ApiResponse({
    status: 200,
    description:
      '{ success: true } when deleted, { success: true, requiresEmailConfirmation: true } when an email link was sent instead.',
  })
  @ApiResponse({
    status: 400,
    description:
      'No credentials supplied for an account that has a password or MFA enrolled.',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid JWT, or wrong credentials supplied.',
  })
  @ApiResponse({ status: 429, description: 'Too many deletion attempts.' })
  @UseGuards(CustomThrottlerGuard)
  @Throttle({ default: { ttl: 900000, limit: 5 } })
  @ThrottleMessage('Too many deletion attempts')
  @Delete('me')
  async deleteMe(
    @Req() request: AuthRequest,
    @Body() body: DeleteMeDto,
  ): Promise<{
    success: true;
    requiresEmailConfirmation?: true;
  }> {
    const result = await this.authService.deleteAccount(
      request.user.userId,
      body.currentPassword,
      body.code,
    );
    if ('requiresEmailConfirmation' in result) {
      return { success: true, requiresEmailConfirmation: true };
    }
    return { success: true };
  }
}
