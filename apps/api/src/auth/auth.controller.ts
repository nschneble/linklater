import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { LocalAuthGuard } from './local-auth.guard.js';
import { MfaAuthGuard } from './mfa-auth.guard.js';
import { TotpService } from './totp.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { RequestEmailChangeDto } from './dto/request-email-change.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { Disable2faDto } from './dto/disable-2fa.dto.js';
import { RegenerateRecoveryCodesDto } from './dto/regenerate-recovery-codes.dto.js';
import { SmsSetupDto } from './dto/sms-setup.dto.js';
import { SmsVerifySetupDto } from './dto/sms-verify-setup.dto.js';
import { TotpVerifySetupDto } from './dto/totp-verify-setup.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { SmsSetupService } from '../sms/sms-setup.service.js';
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
  constructor(
    private readonly authService: AuthService,
    private readonly smsSetupService: SmsSetupService,
    private readonly totpService: TotpService,
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
    status: 200,
    description: 'Returns a signed JWT accessToken.',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 429, description: 'Too many login attempts.' })
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-login': { ttl: 60000, limit: 10 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(200)
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
    await this.authService.requestEmailChange(
      request.user.userId,
      body.email,
      body.code,
    );
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

  /**
   * Step 2 of 2FA login. Validates the OTP or recovery code and issues the
   * full session JWT. Rate-limited to 5 attempts per 15 minutes per IP.
   */
  @ApiOperation({
    summary: 'Verify an OTP or recovery code to complete 2FA login',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns a signed JWT accessToken.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired MFA token or code.',
  })
  @ApiResponse({ status: 429, description: 'Too many OTP attempts.' })
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-verify-otp': { ttl: 900000, limit: 5 } })
  @UseGuards(MfaAuthGuard)
  @Post('verify-otp')
  @HttpCode(200)
  async verifyOtp(@Req() request: AuthRequest, @Body() body: VerifyOtpDto) {
    return this.authService.verifyOtp(
      request.user.userId,
      body.code,
      body.method,
    );
  }

  @ApiOperation({ summary: 'Generate a TOTP setup QR code and secret' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Returns qrCodeDataUrl and plaintext secret.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Email not yet verified.' })
  @ApiResponse({ status: 409, description: 'TOTP is already active.' })
  @UseGuards(JwtAuthGuard)
  @Post('2fa/totp/setup')
  @HttpCode(200)
  async totpSetup(@Req() request: AuthRequest) {
    return this.totpService.generateSetup(
      request.user.userId,
      request.user.email,
    );
  }

  @ApiOperation({ summary: 'Verify TOTP setup and receive recovery codes' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'TOTP enabled. Returns recovery codes.',
  })
  @ApiResponse({
    status: 400,
    description: 'No pending setup or invalid code.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @UseGuards(JwtAuthGuard)
  @Post('2fa/totp/verify')
  @HttpCode(200)
  async totpVerifySetup(
    @Req() request: AuthRequest,
    @Body() body: TotpVerifySetupDto,
  ) {
    const recoveryCodes = await this.totpService.verifySetup(
      request.user.userId,
      body.code,
    );
    return { recoveryCodes };
  }

  @ApiOperation({ summary: 'Initiate SMS 2FA setup' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Verification code sent.' })
  @ApiResponse({ status: 400, description: 'Invalid phone number format.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Email not verified.' })
  @ApiResponse({ status: 409, description: 'SMS 2FA already enabled.' })
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ 'auth-2fa-sms-setup': { ttl: 60000, limit: 3 } })
  @Post('2fa/sms/setup')
  @HttpCode(200)
  async smsSetup(
    @Req() request: AuthRequest,
    @Body() body: SmsSetupDto,
  ): Promise<void> {
    await this.smsSetupService.initiateSetup(
      request.user.userId,
      body.phoneNumber,
    );
  }

  @ApiOperation({ summary: 'Verify and complete SMS 2FA setup' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'SMS 2FA enabled. Returns one-time recovery codes.',
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired code.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ 'auth-2fa-sms-verify': { ttl: 60000, limit: 5 } })
  @Post('2fa/sms/verify')
  @HttpCode(200)
  async smsVerify(
    @Req() request: AuthRequest,
    @Body() body: SmsVerifySetupDto,
  ): Promise<{ recoveryCodes: string[] }> {
    const recoveryCodes = await this.smsSetupService.verifySetup(
      request.user.userId,
      body.code,
    );
    return { recoveryCodes };
  }

  @ApiOperation({
    summary: 'Resend SMS verification code during MFA challenge',
  })
  @ApiResponse({ status: 200, description: 'New verification code sent.' })
  @ApiResponse({ status: 401, description: 'Invalid or expired MFA token.' })
  @ApiResponse({ status: 429, description: 'Too many resend attempts.' })
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-sms-resend': { ttl: 60000, limit: 3 } })
  @UseGuards(MfaAuthGuard)
  @Post('2fa/sms/resend')
  @HttpCode(200)
  async smsResend(@Req() request: AuthRequest): Promise<void> {
    await this.smsSetupService.smsResend(request.user.userId);
  }

  @ApiOperation({
    summary: 'Disable 2FA (requires password or OTP re-authentication)',
  })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: '2FA disabled successfully.' })
  @ApiResponse({ status: 400, description: 'No credential provided.' })
  @ApiResponse({
    status: 401,
    description: 'Invalid credential or missing JWT.',
  })
  @ApiResponse({ status: 429, description: 'Too many disable attempts.' })
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ 'auth-disable-2fa': { ttl: 900000, limit: 5 } })
  @Delete('2fa')
  @HttpCode(200)
  async disable2fa(@Req() request: AuthRequest, @Body() body: Disable2faDto) {
    await this.authService.disable2fa(
      request.user.userId,
      body.currentPassword,
      body.code,
    );
  }

  @ApiOperation({
    summary: 'Regenerate recovery codes (requires re-authentication)',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Returns 10 new plaintext recovery codes.',
  })
  @ApiResponse({ status: 400, description: 'No credential provided.' })
  @ApiResponse({
    status: 401,
    description: 'Invalid credential or missing JWT.',
  })
  @UseGuards(JwtAuthGuard)
  @Post('2fa/recovery-codes/regenerate')
  @HttpCode(200)
  async regenerateRecoveryCodes(
    @Req() request: AuthRequest,
    @Body() body: RegenerateRecoveryCodesDto,
  ) {
    const recoveryCodes = await this.authService.regenerateRecoveryCodes(
      request.user.userId,
      body.currentPassword,
      body.code,
    );
    return { recoveryCodes };
  }

  @ApiOperation({
    summary:
      'Get recovery codes — regenerates a new set (requires re-authentication)',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Returns 10 new plaintext recovery codes.',
  })
  @ApiResponse({ status: 400, description: 'No credential provided.' })
  @ApiResponse({
    status: 401,
    description: 'Invalid credential or missing JWT.',
  })
  @UseGuards(JwtAuthGuard)
  @Post('2fa/recovery-codes')
  @HttpCode(200)
  async getRecoveryCodes(
    @Req() request: AuthRequest,
    @Body() body: RegenerateRecoveryCodesDto,
  ) {
    const recoveryCodes = await this.authService.regenerateRecoveryCodes(
      request.user.userId,
      body.currentPassword,
      body.code,
    );
    return { recoveryCodes };
  }

  @ApiOperation({ summary: 'Initiate Google OAuth sign-in' })
  @UseGuards(AuthGuard('google'))
  @Get('google')
  async googleAuth() {
    // Passport redirects to Google — no body needed
  }

  @ApiOperation({ summary: 'Google OAuth callback' })
  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  async googleCallback(@Req() request: AuthRequest, @Res() response: Response) {
    const { accessToken } = await this.authService.login(request.user);
    response.redirect(
      `${process.env.APP_URL}/oauth/callback#token=${accessToken}`,
    );
  }

  @ApiOperation({ summary: 'Initiate Apple Sign In' })
  @UseGuards(AuthGuard('apple'))
  @Get('apple')
  async appleAuth() {
    // Passport redirects to Apple — no body needed
  }

  @ApiOperation({ summary: 'Apple Sign In callback' })
  @UseGuards(AuthGuard('apple'))
  @Post('apple/callback')
  async appleCallback(@Req() request: AuthRequest, @Res() response: Response) {
    const { accessToken } = await this.authService.login(request.user);
    response.redirect(
      `${process.env.APP_URL}/oauth/callback#token=${accessToken}`,
    );
  }
}
