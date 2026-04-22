import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { LocalAuthGuard } from './local-auth.guard.js';
import { RegisterDto } from './dto/register.dto.js';
import { UsersService } from '../users/index.js';
import type { AuthRequest } from './auth-request.type.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    const user = await this.usersService.create(body.email, body.password);
    return user;
  }

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
}
