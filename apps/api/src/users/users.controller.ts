import {
  Controller,
  Delete,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard, type AuthRequest } from '../auth/index.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() request: AuthRequest) {
    return this.usersService.findById(request.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@Req() request: AuthRequest, @Body() body: UpdateMeDto) {
    return this.usersService.updateMe(request.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  async deleteMe(@Req() request: AuthRequest) {
    await this.usersService.deleteById(request.user.userId);
    return { success: true };
  }
}
