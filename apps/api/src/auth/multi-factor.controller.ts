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
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CustomThrottlerGuard } from './custom-throttler.guard.js';
import { DisableMfaDto } from './dto/disable-mfa.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { MfaAuthGuard } from './mfa-auth.guard.js';
import { RegenerateRecoveryCodesDto } from './dto/regenerate-recovery-codes.dto.js';
import { Throttle } from '@nestjs/throttler';
import { ThrottleMessage } from './throttle-message.decorator.js';
import { TotpService } from './totp.service.js';
import { TotpVerifySetupDto } from './dto/totp-verify-setup.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import type { AuthRequest } from './auth-request.type.js';

/**
 * Multi-factor authentication endpoints: TOTP setup/verify, OTP challenge,
 * disable, and recovery-code regeneration. Shares the `auth` prefix.
 */
@ApiTags('auth')
@Controller('auth')
export class MultiFactorController {
  constructor(
    private readonly authService: AuthService,
    private readonly totpService: TotpService,
  ) {}

  /**
   * Step 2 of MFA login. Validates the OTP or recovery code and issues the
   * full session JWT. Rate-limited to 5 attempts per 15 minutes per IP.
   */
  @ApiOperation({
    summary: 'Verify an OTP or recovery code to complete MFA login',
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
  // 15-min window: OTP brute-force slowdown
  @Throttle({ default: { ttl: 900000, limit: 5 } })
  @ThrottleMessage('Too many OTP attempts')
  @Post('verify-otp')
  @HttpCode(200)
  async verifyOtp(@Req() request: AuthRequest, @Body() body: VerifyOtpDto) {
    return this.authService.verifyOtp(
      request.user.userId,
      body.code,
      body.method,
      request.user.nonce,
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
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ThrottleMessage('Too many setup attempts')
  @Post('mfa/totp/setup')
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
  // 15-min window: OTP brute-force slowdown
  @Throttle({ default: { ttl: 900000, limit: 5 } })
  @ThrottleMessage('Too many verify attempts')
  @Post('mfa/totp/verify')
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

  @ApiOperation({ summary: 'Cancel an in-flight TOTP setup' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 204,
    description: 'Pending setup cleared (idempotent).',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 409, description: 'TOTP is already enabled.' })
  @UseGuards(JwtAuthGuard)
  @Delete('mfa/totp/setup')
  @HttpCode(204)
  async totpCancelSetup(@Req() request: AuthRequest) {
    await this.totpService.cancelSetup(request.user.userId);
  }

  @ApiOperation({
    summary: 'Disable MFA (requires password or OTP re-authentication)',
  })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'MFA disabled successfully.' })
  @ApiResponse({ status: 400, description: 'No credential provided.' })
  @ApiResponse({
    status: 401,
    description: 'Invalid credential or missing JWT.',
  })
  @ApiResponse({ status: 429, description: 'Too many disable attempts.' })
  @UseGuards(JwtAuthGuard, CustomThrottlerGuard)
  // 15-min window: credential brute-force slowdown
  @Throttle({ default: { ttl: 900000, limit: 5 } })
  @ThrottleMessage('Too many disable attempts')
  @Delete('mfa')
  @HttpCode(200)
  async disableMfa(@Req() request: AuthRequest, @Body() body: DisableMfaDto) {
    await this.authService.disableMfa(
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
  // 15-min window: credential brute-force slowdown
  @Throttle({ default: { ttl: 900000, limit: 5 } })
  @ThrottleMessage('Too many re-auth attempts')
  @Post('mfa/recovery-codes/regenerate')
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
}
