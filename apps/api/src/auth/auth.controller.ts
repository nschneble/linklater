import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { LocalAuthGuard } from './local-auth.guard.js';
import { RegisterDto } from './dto/register.dto.js';
import { RequestEmailChangeDto } from './dto/request-email-change.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { UsersService } from '../users/index.js';
import type { AuthRequest } from './auth-request.type.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-register': { ttl: 60000, limit: 5 } })
  @Post('register')
  async register(@Body() body: RegisterDto) {
    const user = await this.usersService.create(body.email, body.password);
    await this.authService.sendVerificationEmail(user.id);
    return user;
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-login': { ttl: 60000, limit: 10 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() request: AuthRequest) {
    return this.authService.login(request.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() request: AuthRequest) {
    const { id, ...rest } = await this.usersService.findById(
      request.user.userId,
    );
    return { userId: id, ...rest };
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-verify-email': { ttl: 60000, limit: 10 } })
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() body: VerifyEmailDto) {
    await this.authService.verifyEmail(body.token);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-forgot-password': { ttl: 60000, limit: 3 } })
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.authService.forgotPassword(body.email);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-reset-password': { ttl: 60000, limit: 5 } })
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.authService.resetPassword(body.token, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-resend-verification': { ttl: 60000, limit: 3 } })
  @Post('resend-verification')
  @HttpCode(200)
  async resendVerification(@Req() request: AuthRequest) {
    await this.authService.resendVerificationEmail(request.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-request-email-change': { ttl: 60000, limit: 3 } })
  @Post('request-email-change')
  @HttpCode(200)
  async requestEmailChange(
    @Req() request: AuthRequest,
    @Body() body: RequestEmailChangeDto,
  ) {
    await this.authService.requestEmailChange(request.user.userId, body.email);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ 'auth-verify-email-change': { ttl: 60000, limit: 10 } })
  @Post('verify-email-change')
  @HttpCode(200)
  async verifyEmailChange(@Body() body: VerifyEmailDto) {
    await this.authService.confirmEmailChange(body.token);
  }
}
