import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard, type AuthRequest } from '../auth/index.js';
import { CreateTokenDto } from './dto/create-token.dto.js';
import { TokensService } from './tokens.service.js';

/**
 * Manages personal access tokens (PATs) for the authenticated user.
 * PATs allow browser extensions and other clients to authenticate without
 * a full login flow. Each token is shown only once at creation time.
 */
@ApiTags('tokens')
@ApiBearerAuth()
@Controller('tokens')
@UseGuards(JwtAuthGuard)
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @ApiOperation({ summary: 'Create a personal access token' })
  @ApiResponse({
    status: 201,
    description: 'Token created. The raw token value is shown only this once.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @Post()
  async create(@Req() request: AuthRequest, @Body() body: CreateTokenDto) {
    const userId = request.user.userId;
    return this.tokensService.create(userId, body.name);
  }

  @ApiOperation({ summary: "List the current user's personal access tokens" })
  @ApiResponse({
    status: 200,
    description: 'Array of token summaries (no raw values).',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @Get()
  async findAll(@Req() request: AuthRequest) {
    const userId = request.user.userId;
    return this.tokensService.findAll(userId);
  }

  @ApiOperation({ summary: 'Revoke a personal access token' })
  @ApiParam({ name: 'id', description: 'ID of the token to revoke.' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 404, description: 'Token not found.' })
  @HttpCode(200)
  @Delete(':id')
  async revoke(@Req() request: AuthRequest, @Param('id') id: string) {
    const userId = request.user.userId;
    await this.tokensService.revoke(userId, id);
    return { success: true };
  }
}
