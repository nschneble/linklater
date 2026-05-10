import {
  Controller,
  Delete,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { JwtAuthGuard, type AuthRequest } from '../auth/index.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { UsersService } from './users.service.js';

/**
 * Endpoints for the authenticated user to read and manage their own account.
 * Every route requires a valid JWT — no user can access another user's data.
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Returns the current user's profile. Unlike `GET /auth/me`, this endpoint
   * includes all user fields and does not remap `id` to `userId`.
   */
  @ApiOperation({ summary: 'Get the current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile without passwordHash.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @Get('me')
  async getMe(@Req() request: AuthRequest) {
    return this.usersService.findById(request.user.userId);
  }

  /**
   * Updates the current user's account settings. Accepts any combination of
   * `password`, `theme`, and `mode` — all fields are optional. Changing the
   * password requires `currentPassword` as well.
   */
  @ApiOperation({ summary: 'Update account settings (password, theme, mode)' })
  @ApiResponse({
    status: 200,
    description: 'Updated user profile without passwordHash.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid input (e.g. wrong current password, unsupported theme).',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid JWT or incorrect current password.',
  })
  @Patch('me')
  async updateMe(@Req() request: AuthRequest, @Body() body: UpdateMeDto) {
    return this.usersService.updateMe(request.user.userId, body);
  }

  /**
   * Permanently deletes the current user's account and all associated links.
   * After this call the JWT is no longer valid — the front-end should clear
   * the stored token and redirect to the login page.
   */
  @ApiOperation({ summary: 'Permanently delete the current user account' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @Delete('me')
  async deleteMe(@Req() request: AuthRequest) {
    await this.usersService.deleteById(request.user.userId);
    return { success: true };
  }
}
