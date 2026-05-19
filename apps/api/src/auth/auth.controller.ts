import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
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
import { Throttle } from '@nestjs/throttler';
import { CustomThrottlerGuard } from './custom-throttler.guard.js';
import { ThrottleMessage } from './throttle-message.decorator.js';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { OAuthAccountService } from './oauth-account.service.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { SetPasswordDto } from './dto/set-password.dto.js';
import { generateLinkState } from './oauth-link-state.js';
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
import { TotpVerifySetupDto } from './dto/totp-verify-setup.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ExtensionTokenDto } from './dto/extension-token.dto.js';
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
    private readonly emailVerificationService: EmailVerificationService,
    private readonly oauthAccountService: OAuthAccountService,
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
  @UseGuards(CustomThrottlerGuard)
  @Throttle({ 'auth-register': { ttl: 60000, limit: 5 } })
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
  @Throttle({ 'auth-login': { ttl: 60000, limit: 10 } })
  @ThrottleMessage('Too many login attempts')
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
  @UseGuards(CustomThrottlerGuard)
  @Throttle({ 'auth-verify-email': { ttl: 60000, limit: 10 } })
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
  @Throttle({ 'auth-forgot-password': { ttl: 60000, limit: 3 } })
  @ThrottleMessage('Too many forgot-password attempts')
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.emailVerificationService.forgotPassword(body.email);
  }

  /**
   * Replaces the user's password using the one-time reset token. The token
   * expires after 1 hour. Rate-limited to 5 requests per 60 seconds per IP.
   */
  @ApiOperation({ summary: 'Reset password using the emailed token' })
  @ApiResponse({ status: 200, description: 'Password updated successfully.' })
  @ApiResponse({ status: 400, description: 'Token is invalid or expired.' })
  @ApiResponse({ status: 429, description: 'Too many reset attempts.' })
  @UseGuards(CustomThrottlerGuard)
  @Throttle({ 'auth-reset-password': { ttl: 60000, limit: 5 } })
  @ThrottleMessage('Too many reset attempts')
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.emailVerificationService.resetPassword(
      body.token,
      body.password,
    );
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
  @Throttle({ 'auth-resend-verification': { ttl: 60000, limit: 3 } })
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
  @Throttle({ 'auth-request-email-change': { ttl: 60000, limit: 3 } })
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
  @Throttle({ 'auth-verify-email-change': { ttl: 60000, limit: 10 } })
  @ThrottleMessage('Too many verification attempts')
  @Post('verify-email-change')
  @HttpCode(200)
  async verifyEmailChange(@Body() body: VerifyEmailDto) {
    await this.emailVerificationService.confirmEmailChange(body.token);
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
  @UseGuards(CustomThrottlerGuard, MfaAuthGuard)
  @Throttle({ 'auth-verify-otp': { ttl: 900000, limit: 5 } })
  @ThrottleMessage('Too many OTP attempts')
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
  @ApiResponse({ status: 429, description: 'Too many setup attempts.' })
  @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  @Throttle({ 'auth-2fa-totp-setup': { ttl: 60000, limit: 5 } })
  @ThrottleMessage('Too many setup attempts')
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
  @ApiResponse({ status: 429, description: 'Too many verify attempts.' })
  @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  @Throttle({ 'auth-2fa-totp-verify': { ttl: 900000, limit: 5 } })
  @ThrottleMessage('Too many verify attempts')
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

  @ApiOperation({
    summary: 'Request a magic link login email',
  })
  @ApiResponse({
    status: 200,
    description: 'Magic link sent (or silently skipped if address not found).',
  })
  @ApiResponse({ status: 429, description: 'Too many magic link requests.' })
  @UseGuards(CustomThrottlerGuard)
  @Throttle({ 'auth-request-magic-link': { ttl: 60000, limit: 3 } })
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
  @Throttle({ 'auth-register': { ttl: 60000, limit: 5 } })
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
  @Throttle({ 'auth-verify-magic-link': { ttl: 60000, limit: 10 } })
  @ThrottleMessage('Too many verification attempts')
  @Post('verify-magic-link')
  @HttpCode(200)
  async verifyMagicLink(@Body() body: VerifyEmailDto) {
    return this.authService.verifyMagicLink(body.token);
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
  @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  @Throttle({ 'auth-disable-2fa': { ttl: 900000, limit: 5 } })
  @ThrottleMessage('Too many disable attempts')
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
  @ApiResponse({ status: 429, description: 'Too many re-auth attempts.' })
  @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  @Throttle({ 'auth-reauth': { ttl: 900000, limit: 5 } })
  @ThrottleMessage('Too many re-auth attempts')
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
    await this.completeOAuthLogin(request, response);
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
    await this.completeOAuthLogin(request, response);
  }

  /**
   * Shared OAuth post-login handler. Issues a session for the authenticated
   * user and redirects the browser to the SPA's `/oauth/callback` route with
   * the tokens in the URL fragment (fragments are never sent to servers or
   * logged in Referer headers). When 2FA is enabled, redirects to `/login`
   * with an error code instead, since OAuth callbacks can't show an OTP form.
   */
  private async completeOAuthLogin(
    request: AuthRequest,
    response: Response,
  ): Promise<void> {
    const result = await this.authService.login(request.user);
    if (!('accessToken' in result)) {
      response.redirect(`${process.env.APP_URL}/login?error=mfa_required`);
      return;
    }
    response.redirect(
      `${process.env.APP_URL}/oauth/callback#token=${result.accessToken}&refresh=${result.refreshToken}`,
    );
  }

  @ApiOperation({ summary: 'Initiate Google OAuth account linking' })
  @ApiBearerAuth()
  @ApiResponse({ status: 302, description: 'Redirects to Google OAuth.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @UseGuards(JwtAuthGuard)
  @Get('google/link')
  async googleLink(@Req() request: AuthRequest, @Res() response: Response) {
    const linkState = generateLinkState(
      request.user.userId,
      process.env.JWT_SECRET!,
    );
    const parameters = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: process.env.GOOGLE_LINK_CALLBACK_URL!,
      response_type: 'code',
      scope: 'email profile',
      state: linkState,
    });
    response.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${parameters.toString()}`,
    );
  }

  @ApiOperation({ summary: 'Google OAuth account linking callback' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to settings on success or failure.',
  })
  @UseGuards(AuthGuard('google-link'))
  @Get('google/link/callback')
  async googleLinkCallback(
    @Req()
    request: {
      user: { userId: string; providerId: string; providerEmail: string };
    },
    @Res() response: Response,
  ) {
    try {
      await this.oauthAccountService.linkOAuthAccountToUser(
        request.user.userId,
        'google',
        request.user.providerId,
        request.user.providerEmail,
      );
    } catch (error) {
      if (error instanceof ConflictException) {
        response.redirect(
          `${process.env.APP_URL}/settings?link_error=already_linked`,
        );
        return;
      }
      if (error instanceof BadRequestException) {
        response.redirect(
          `${process.env.APP_URL}/settings?link_error=email_mismatch`,
        );
        return;
      }
      throw error;
    }
    response.redirect(`${process.env.APP_URL}/settings?linked=google`);
  }

  @ApiOperation({ summary: 'Disconnect an OAuth provider' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Provider disconnected.' })
  @ApiResponse({
    status: 400,
    description: 'No password set — cannot disconnect.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @UseGuards(JwtAuthGuard)
  @Delete('providers/:provider')
  @HttpCode(200)
  async unlinkProvider(
    @Req() request: AuthRequest,
    @Param('provider') provider: string,
  ) {
    await this.oauthAccountService.unlinkOAuthProvider(
      request.user.userId,
      provider,
    );
    return { success: true };
  }

  @ApiOperation({ summary: 'Set a password for an SSO-only account' })
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
  @Throttle({ 'auth-refresh': { ttl: 60000, limit: 10 } })
  @ThrottleMessage('Too many refresh attempts')
  @Post('refresh')
  @HttpCode(200)
  async refreshToken(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }

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

  @ApiOperation({ summary: 'Authorize a browser extension (PKCE flow)' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 302,
    description: 'Redirects to redirect_uri with auth code.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid redirect_uri or missing parameters.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @UseGuards(JwtAuthGuard)
  @Get('extension/authorize')
  async extensionAuthorize(
    @Req() request: AuthRequest,
    @Res() response: Response,
    @Query('code_challenge') codeChallenge: string,
    @Query('redirect_uri') redirectUri: string,
  ) {
    const { code, callbackUrl } = await this.authService.authorizeExtension(
      request.user.userId,
      codeChallenge,
      redirectUri,
    );

    const destination = new URL(callbackUrl);
    destination.searchParams.set('code', code);
    response.redirect(destination.toString());
  }

  @ApiOperation({ summary: 'Exchange extension auth code for token pair' })
  @ApiResponse({
    status: 200,
    description: 'Returns accessToken and refreshToken.',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid code or PKCE verifier.',
  })
  @Post('extension/token')
  @HttpCode(200)
  async extensionToken(@Body() body: ExtensionTokenDto) {
    return this.authService.exchangeExtensionCode(body.code, body.codeVerifier);
  }
}
