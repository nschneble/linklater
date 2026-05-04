import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
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
import { ResetPasswordDto } from './dto/reset-password.dto.js';
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

  @Get('verify-email/:token')
  async verifyEmail(@Param('token') token: string) {
    await this.authService.verifyEmail(token);
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.authService.resetPassword(body.token, body.password);
  }
}
