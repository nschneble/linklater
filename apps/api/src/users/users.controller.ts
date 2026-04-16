import {
  Controller,
  Delete,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthRequest } from '../auth/auth-request.type.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: AuthRequest) {
    const user = await this.usersService.findById(req.user.userId);
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(
    @Req() req: AuthRequest,
    @Body() body: { email?: string; password?: string },
  ) {
    return this.usersService.updateMe(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  async deleteMe(@Req() req: AuthRequest) {
    await this.usersService.deleteById(req.user.userId);
    return { success: true };
  }
}
