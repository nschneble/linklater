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
import { Throttle } from '@nestjs/throttler';

import { CustomThrottlerGuard } from '../auth/custom-throttler.guard.js';
import { JwtAuthGuard, type AuthRequest } from '../auth/index.js';
import { ThrottleMessage } from '../auth/throttle-message.decorator.js';
import { ApiDocsTokensService } from './api-docs-tokens.service.js';
import { BookmarkletTokensService } from './bookmarklet-tokens.service.js';
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
  constructor(
    private readonly tokensService: TokensService,
    private readonly bookmarkletTokensService: BookmarkletTokensService,
    private readonly apiDocsTokensService: ApiDocsTokensService,
  ) {}

  @ApiOperation({ summary: 'Create a personal access token' })
  @ApiResponse({
    status: 201,
    description: 'Token created. The raw token value is shown only this once.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({
    status: 429,
    description: 'Too many token-creation attempts.',
  })
  @UseGuards(CustomThrottlerGuard)
  @Throttle({ default: { ttl: 3600000, limit: 20 } })
  @ThrottleMessage('Too many token-creation attempts')
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

  @ApiOperation({ summary: 'Get or create the bookmarklet token' })
  @ApiResponse({
    status: 200,
    description:
      "Returns the user's bookmarklet PAT, creating one if none exists. " +
      'Unlike user-created PATs, the raw token is returned on every call ' +
      'so the bookmarklet `javascript:` URL can be re-embedded across devices.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @Get('bookmarklet')
  async getBookmarklet(@Req() request: AuthRequest) {
    const userId = request.user.userId;
    return this.bookmarkletTokensService.getOrCreate(userId);
  }

  @ApiOperation({ summary: 'Regenerate the bookmarklet token' })
  @ApiResponse({
    status: 200,
    description:
      'Revokes the current bookmarklet PAT and mints a fresh one. ' +
      'The returned raw token replaces the previous embedded value.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @HttpCode(200)
  @Post('bookmarklet/regenerate')
  async regenerateBookmarklet(@Req() request: AuthRequest) {
    const userId = request.user.userId;
    return this.bookmarkletTokensService.regenerate(userId);
  }

  @ApiOperation({ summary: 'Get or create the API docs token' })
  @ApiResponse({
    status: 200,
    description:
      "Returns the user's hidden API-docs PAT, creating one if none exists. " +
      'Like the bookmarklet token, the raw token is returned on every call. ' +
      'Auto-provisioned server-side, never expires, and has no regenerate path.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @Get('api-docs')
  async getApiDocs(@Req() request: AuthRequest) {
    const userId = request.user.userId;
    return this.apiDocsTokensService.getOrCreate(userId);
  }

  @ApiOperation({ summary: 'Revoke a personal access token' })
  @ApiParam({ name: 'id', description: 'ID of the token to revoke.' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @ApiResponse({
    status: 400,
    description:
      'Token is a bookmarklet token; use the Regenerate endpoint instead.',
  })
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
