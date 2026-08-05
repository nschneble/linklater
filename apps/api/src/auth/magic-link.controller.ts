import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CustomThrottlerGuard } from './custom-throttler.guard.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { Throttle } from '@nestjs/throttler';
import { ThrottleMessage } from './throttle-message.decorator.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';

/**
 * Passwordless magic-link authentication: request, signup, and verify.
 * All responses return 200 regardless of whether the email exists to avoid
 * user enumeration.
 */
@ApiTags('auth')
@Controller('auth')
export class MagicLinkController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Request a magic link login email',
  })
  @ApiResponse({
    status: 200,
    description: 'Magic link sent (or silently skipped if address not found).',
  })
  @ApiResponse({ status: 429, description: 'Too many magic link requests.' })
  @UseGuards(CustomThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ThrottleMessage('Too many magic link requests')
  @Post('request-magic-link')
  @HttpCode(200)
  async requestMagicLink(@Body() body: ForgotPasswordDto): Promise<void> {
    await this.authService.requestMagicLink(body.email);
  }

  @ApiOperation({
    summary: 'Register with a magic link (passwordless sign-up)',
  })
  @ApiResponse({
    status: 200,
    description: 'Magic link sent (account created if new).',
  })
  @ApiResponse({ status: 429, description: 'Too many registration attempts.' })
  @UseGuards(CustomThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ThrottleMessage('Too many registration attempts')
  @Post('register-magic-link')
  @HttpCode(200)
  async registerMagicLink(@Body() body: ForgotPasswordDto): Promise<void> {
    await this.authService.registerMagicLink(body.email);
  }

  @ApiOperation({
    summary: 'Verify a magic link token and issue a session JWT',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns a signed JWT accessToken.',
  })
  @ApiResponse({ status: 400, description: 'Token is invalid or expired.' })
  @ApiResponse({ status: 429, description: 'Too many verification attempts.' })
  @UseGuards(CustomThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ThrottleMessage('Too many verification attempts')
  @Post('verify-magic-link')
  @HttpCode(200)
  async verifyMagicLink(@Body() body: VerifyEmailDto) {
    return this.authService.verifyMagicLink(body.token);
  }
}
