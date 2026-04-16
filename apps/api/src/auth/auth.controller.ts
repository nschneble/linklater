import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LocalAuthGuard } from './local-auth.guard.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { UsersService } from '../users/users.service.js';
import type { AuthRequest } from './auth-request.type.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  async register(
    @Body() body: { email: string; password: string },
  ) {
    const user = await this.usersService.create(body.email, body.password);
    return user;
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: AuthRequest) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: AuthRequest) {
    return req.user;
  }
}
