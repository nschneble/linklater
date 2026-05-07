import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { LocalAuthGuard } from './local-auth.guard.js';
import { RegisterDto } from './dto/register.dto.js';
import { RequestEmailChangeDto } from './dto/request-email-change.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import type { AuthRequest } from './auth-request.type.js';

/**
 * All authentication endpoints. Rate-limited per route to reduce brute-force
 * and abuse risk. Unauthenticated endpoints intentionally return the same
 * 200 success response regardless of whether the email exists — this prevents
 * user enumeration attacks.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-register': { ttl: 60000, limit: 5 } })
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
    status: 201,
    description: 'Returns a signed JWT accessToken.',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 429, description: 'Too many login attempts.' })
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-login': { ttl: 60000, limit: 10 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() request: AuthRequest) {
    return this.authService.login(request.user);
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
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-verify-email': { ttl: 60000, limit: 10 } })
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() body: VerifyEmailDto) {
    await this.authService.verifyEmail(body.token);
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
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-forgot-password': { ttl: 60000, limit: 3 } })
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.authService.forgotPassword(body.email);
  }

  /**
   * Replaces the user's password using the one-time reset token. The token
   * expires after 1 hour. Rate-limited to 5 requests per 60 seconds per IP.
   */
  @ApiOperation({ summary: 'Reset password using the emailed token' })
  @ApiResponse({ status: 200, description: 'Password updated successfully.' })
  @ApiResponse({ status: 400, description: 'Token is invalid or expired.' })
  @ApiResponse({ status: 429, description: 'Too many reset attempts.' })
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-reset-password': { ttl: 60000, limit: 5 } })
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.authService.resetPassword(body.token, body.password);
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
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ 'auth-resend-verification': { ttl: 60000, limit: 3 } })
  @Post('resend-verification')
  @HttpCode(200)
  async resendVerification(@Req() request: AuthRequest) {
    await this.authService.resendVerificationEmail(request.user.userId);
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
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ 'auth-request-email-change': { ttl: 60000, limit: 3 } })
  @Post('request-email-change')
  @HttpCode(200)
  async requestEmailChange(
    @Req() request: AuthRequest,
    @Body() body: RequestEmailChangeDto,
  ) {
    await this.authService.requestEmailChange(request.user.userId, body.email);
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
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-verify-email-change': { ttl: 60000, limit: 10 } })
  @Post('verify-email-change')
  @HttpCode(200)
  async verifyEmailChange(@Body() body: VerifyEmailDto) {
    await this.authService.confirmEmailChange(body.token);
  }
}
