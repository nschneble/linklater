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
import { JwtAuthGuard } from '../auth/index.js';
import type { AuthRequest } from '../auth/index.js';
import { UpdateMeDto } from './dto/update-me.dto.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: AuthRequest) {
    return this.usersService.findById(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@Req() req: AuthRequest, @Body() body: UpdateMeDto) {
    return this.usersService.updateMe(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  async deleteMe(@Req() req: AuthRequest) {
    await this.usersService.deleteById(req.user.userId);
    return { success: true };
  }
}
