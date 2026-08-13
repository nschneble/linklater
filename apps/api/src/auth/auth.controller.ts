import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CustomThrottlerGuard } from './custom-throttler.guard.js';
import { EmailVerificationService } from './email-verification.service.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { LocalAuthGuard } from './local-auth.guard.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RequestEmailChangeDto } from './dto/request-email-change.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { SetPasswordDto } from './dto/set-password.dto.js';
import { Throttle } from '@nestjs/throttler';
import { ThrottleMessage } from './throttle-message.decorator.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import type { AuthRequest } from './auth-request.type.js';

/**
 * Core authentication endpoints: register, login, profile, password
 * recovery, email verification, refresh, and session revocation.
 *
 * Related flows live in `OAuthSignInController`, `OAuthLinkController`,
 * `MagicLinkController`, `MultiFactorController`, and
 * `ExtensionAuthController`. All controllers share the `auth` route prefix so
 * external URLs are unchanged.
 *
 * Rate-limited per route to reduce brute-force and abuse risk. Endpoints
 * that operate on email addresses return 200 regardless of whether the
 * address is registered to prevent user enumeration.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  /**
   * Registers a new account and sends an email verification message.
   * Rate-limited to 5 requests per 60 seconds per IP.
   */
  @ApiOperation({ summary: 'Register a new account' })
  @ApiResponse({
    status: 201,
    description: 'Account created. Verification email sent.',
  })
  @ApiResponse({ status: 409, description: 'Email is already registered.' })
  @ApiResponse({ status: 429, description: 'Too many registration attempts.' })
  @UseGuards(CustomThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ThrottleMessage('Too many registration attempts')
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.password);
  }

  /**
   * Authenticates with email and password. `LocalAuthGuard` validates the
   * credentials before this handler runs; `request.user` is already populated.
   * Rate-limited to 10 requests per 60 seconds per IP.
   */
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Returns a signed JWT accessToken.',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 429, description: 'Too many login attempts.' })
  @UseGuards(CustomThrottlerGuard, LocalAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ThrottleMessage('Too many login attempts')
  @Post('login')
  @HttpCode(200)
  async login(@Req() request: AuthRequest) {
    return this.authService.login(request.user.userId);
  }

  /**
   * Returns the authenticated user's profile. Used by the front-end on page
   * load to hydrate auth state from a stored token.
   */
  @ApiOperation({ summary: 'Get the current authenticated user profile' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'The authenticated user profile without passwordHash.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() request: AuthRequest) {
    return this.authService.me(request.user.userId);
  }

  /**
   * Marks the user's email as verified by consuming the one-time token from
   * the verification link. Rate-limited to 10 requests per 60 seconds per IP.
   */
  @ApiOperation({ summary: 'Verify an email address using the emailed token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully.' })
  @ApiResponse({ status: 400, description: 'Token is invalid or expired.' })
  @ApiResponse({ status: 429, description: 'Too many verification attempts.' })
  @UseGuards(CustomThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ThrottleMessage('Too many verification attempts')
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() body: VerifyEmailDto) {
    await this.emailVerificationService.verifyEmail(body.token);
  }

  /**
   * Sends a password reset link. Always returns 200 regardless of whether
   * the email exists to prevent user enumeration. Rate-limited to 3 requests
   * per 60 seconds per IP.
   */
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({
    status: 200,
    description: 'Reset email sent (or silently skipped if address not found).',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many forgot-password attempts.',
  })
  @UseGuards(CustomThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ThrottleMessage('Too many forgot-password attempts')
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.emailVerificationService.forgotPassword(body.email);
  }

  /**
   * Replaces the user's password using the one-time reset token, then issues
   * a session so the user lands signed in (or in the MFA challenge, for
   * TOTP-enrolled accounts). The token expires after 1 hour. Rate-limited to
   * 5 requests per 60 seconds per IP.
   */
  @ApiOperation({ summary: 'Reset password using the emailed token' })
  @ApiResponse({
    status: 200,
    description:
      'Password updated. Returns a session token pair or MFA challenge.',
  })
  @ApiResponse({ status: 400, description: 'Token is invalid or expired.' })
  @ApiResponse({ status: 429, description: 'Too many reset attempts.' })
  @UseGuards(CustomThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ThrottleMessage('Too many reset attempts')
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.password);
  }

  /**
   * Re-sends the verification email to the currently authenticated but
   * unverified user. Rate-limited to 3 requests per 60 seconds per IP.
   */
  @ApiOperation({ summary: 'Resend the email verification link' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Verification email resent.' })
  @ApiResponse({ status: 400, description: 'Email is already verified.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 429, description: 'Too many resend attempts.' })
  @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ThrottleMessage('Too many resend attempts')
  @Post('resend-verification')
  @HttpCode(200)
  async resendVerification(@Req() request: AuthRequest) {
    await this.emailVerificationService.resendVerificationEmail(
      request.user.userId,
    );
  }

  /**
   * Initiates an email change by storing the new address in `pendingEmail`
   * and sending a verification link to that address. The existing email
   * remains active until the change is confirmed. Rate-limited to 3 requests
   * per 60 seconds per IP.
   */
  @ApiOperation({ summary: 'Request an email address change' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Verification sent to the new email address.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({
    status: 409,
    description: 'New email is already registered to another account.',
  })
  @ApiResponse({ status: 429, description: 'Too many email-change requests.' })
  @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ThrottleMessage('Too many email-change requests')
  @Post('request-email-change')
  @HttpCode(200)
  async requestEmailChange(
    @Req() request: AuthRequest,
    @Body() body: RequestEmailChangeDto,
  ) {
    await this.emailVerificationService.requestEmailChange(
      request.user.userId,
      body.email,
      body.code,
    );
  }

  /**
   * Re-sends the email-change verification link to the address stored in
   * `pendingEmail`. Used when the original link is lost or expired. MFA is not
   * re-checked here; it was enforced when `pendingEmail` was set. Rate-limited
   * to 3 requests per 60 seconds per IP.
   */
  @ApiOperation({ summary: 'Resend the email-change verification link' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Verification email resent.' })
  @ApiResponse({ status: 400, description: 'No email change is pending.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 429, description: 'Too many resend attempts.' })
  @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ThrottleMessage('Too many resend attempts')
  @Post('resend-email-change')
  @HttpCode(200)
  async resendEmailChange(@Req() request: AuthRequest) {
    await this.emailVerificationService.resendEmailChange(request.user.userId);
  }

  /**
   * Confirms the email change by consuming the token sent to the new address.
   * Promotes `pendingEmail` to the primary email. Rate-limited to 10 requests
   * per 60 seconds per IP.
   */
  @ApiOperation({
    summary: 'Confirm an email address change using the emailed token',
  })
  @ApiResponse({ status: 200, description: 'Email updated successfully.' })
  @ApiResponse({ status: 400, description: 'Token is invalid or expired.' })
  @ApiResponse({ status: 429, description: 'Too many verification attempts.' })
  @UseGuards(CustomThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ThrottleMessage('Too many verification attempts')
  @Post('verify-email-change')
  @HttpCode(200)
  async verifyEmailChange(@Body() body: VerifyEmailDto) {
    await this.emailVerificationService.confirmEmailChange(body.token);
  }

  /**
   * Sets a password for an account created via a passwordless flow (e.g.
   * magic link or OAuth). Fails if the account already has a password hash.
   */
  @ApiOperation({ summary: 'Set a password for a passwordless account' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Password set.' })
  @ApiResponse({ status: 400, description: 'Account already has a password.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @UseGuards(JwtAuthGuard)
  @Post('set-password')
  @HttpCode(200)
  async setPassword(@Req() request: AuthRequest, @Body() body: SetPasswordDto) {
    await this.authService.setFirstPassword(request.user.userId, body.password);
    return { success: true };
  }

  /**
   * Exchanges a valid refresh token for a new access/refresh token pair.
   * The old refresh token is rotated (invalidated) on use. Rate-limited to
   * 10 requests per 60 seconds per IP.
   */
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  @ApiResponse({
    status: 200,
    description: 'Returns a new accessToken and rotated refreshToken.',
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token is invalid or expired.',
  })
  @ApiResponse({ status: 429, description: 'Too many refresh attempts.' })
  @UseGuards(CustomThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ThrottleMessage('Too many refresh attempts')
  @Post('refresh')
  @HttpCode(200)
  async refreshToken(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken, body.nextRefreshToken);
  }

  /**
   * Records that the authenticated user has dismissed the post-registration
   * welcome modal so the front-end does not show it again on subsequent loads.
   */
  @ApiOperation({ summary: 'Mark the user as having seen the welcome modal' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Welcome acknowledged.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @UseGuards(JwtAuthGuard)
  @Post('welcome')
  @HttpCode(200)
  async acknowledgeWelcome(@Req() request: AuthRequest) {
    await this.authService.markWelcomed(request.user.userId);
    return { success: true };
  }

  /**
   * Invalidates all refresh tokens for the authenticated user, effectively
   * logging them out of every active session across all devices.
   */
  @ApiOperation({ summary: 'Revoke all refresh tokens (log out everywhere)' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'All sessions revoked.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @UseGuards(JwtAuthGuard)
  @Delete('sessions')
  @HttpCode(200)
  async revokeAllSessions(@Req() request: AuthRequest) {
    await this.authService.revokeAllRefreshTokens(request.user.userId);
    return { success: true };
  }
}
