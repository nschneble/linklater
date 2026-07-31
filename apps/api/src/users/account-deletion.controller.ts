import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Inject,
  Post,
  Req,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from '../auth/auth.service.js';
import { CustomThrottlerGuard } from '../auth/custom-throttler.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ThrottleMessage } from '../auth/throttle-message.decorator.js';
import { ConfirmAccountDeletionDto } from './dto/confirm-account-deletion.dto.js';
import type { AuthRequest } from '../auth/auth-request.type.js';

/**
 * Public + authenticated endpoints for the email-confirmation path of
 * account deletion. Lives under the `/auth/...` URL prefix because the
 * confirmation flow is identity-shaped, but co-located with the rest of
 * the user-deletion code so the service wiring stays in one place.
 */
@ApiTags('auth')
@Controller('auth/account-deletion')
export class AccountDeletionController {
  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  /**
   * Consumes a confirmation token (emailed by `AuthService.deleteAccount`
   * on the email-confirm path) and permanently deletes the user. Public –
   * the email recipient may have signed out, switched browsers, or never
   * been signed in on this device.
   *
   * Rate-limited via a dedicated `auth-account-deletion-confirm` bucket
   * (5 attempts / 15 minutes per IP).
   */
  @ApiOperation({
    summary: 'Confirm and execute a pending account deletion via email link',
  })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @ApiResponse({
    status: 401,
    description: 'Invalid, expired, or already-used confirmation token.',
  })
  @ApiResponse({ status: 429, description: 'Too many confirmation attempts.' })
  @UseGuards(CustomThrottlerGuard)
  // 15-min window: brute-force slowdown on the deletion confirm step
  @Throttle({ default: { ttl: 900000, limit: 5 } })
  @ThrottleMessage('Too many confirmation attempts')
  @Post('confirm')
  @HttpCode(200)
  async confirm(
    @Body() body: ConfirmAccountDeletionDto,
  ): Promise<{ success: true }> {
    await this.authService.confirmAccountDeletion(body.token);
    return { success: true };
  }

  /**
   * Clears any outstanding deletion confirmation token for the current
   * user. Backs the "Never mind, keep my account" affordance on the
   * email-sent panel. Idempotent – returns 204 whether or not a token
   * was actually pending.
   *
   * Rate-limited via `auth-account-deletion-cancel` (10 / 15 min) –
   * slightly higher than the confirm bucket because legitimate UI
   * clicks shouldn't get throttled.
   */
  @ApiOperation({ summary: 'Cancel a pending account-deletion confirmation' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 204,
    description: 'Pending token cleared (idempotent).',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 429, description: 'Too many cancel attempts.' })
  @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  // 15-min window: brute-force slowdown on the cancel step
  @Throttle({ default: { ttl: 900000, limit: 10 } })
  @ThrottleMessage('Too many cancel attempts')
  @Delete('pending')
  @HttpCode(204)
  async cancelPending(@Req() request: AuthRequest): Promise<void> {
    await this.authService.cancelPendingAccountDeletion(request.user.userId);
  }
}
