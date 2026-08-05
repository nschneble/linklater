import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Query,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';

import { AnyAuthGuard, type AuthRequest } from '../auth/index.js';
import {
  DEFAULT_COUNT,
  MAX_COUNT,
  MIN_COUNT,
  SuggestionsQueryDto,
} from './dto/suggestions-query.dto.js';
import { SuggestionsResponseDto } from './dto/suggestions-response.dto.js';
import { SuggestionsService } from './suggestions.service.js';

/**
 * Read-only endpoint that powers the Stumble empty state and the unread
 * list's "How about something from {source}?" callout. Picks a random
 * source per call so the same user gets variety across visits.
 *
 * Auth: `AnyAuthGuard` so browser-extension PATs work alongside the web
 * session; when an extension surfaces suggestions inline this endpoint
 * is already reachable.
 */
@ApiTags('suggestions')
@ApiBearerAuth('pat')
@Controller('suggestions')
@UseGuards(AnyAuthGuard)
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @ApiOperation({
    summary: 'Pick a random source and return N suggestion articles',
  })
  @ApiQuery({
    name: 'count',
    required: false,
    type: Number,
    description: `Number of suggestions to return (default ${DEFAULT_COUNT}, range ${MIN_COUNT}-${MAX_COUNT}).`,
  })
  @ApiResponse({
    status: 200,
    description: 'A picked source name and up to `count` suggestions.',
    type: SuggestionsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid token (JWT or PAT).',
  })
  @ApiResponse({
    status: 503,
    description: 'All sources failed to return any suggestions.',
  })
  @Get()
  async getSuggestions(
    @Req() request: AuthRequest,
    @Query() query: SuggestionsQueryDto,
  ): Promise<SuggestionsResponseDto> {
    const userId = request.user.userId;
    const result = await this.suggestionsService.getSuggestions(
      query.count,
      userId,
    );
    if (!result) {
      throw new ServiceUnavailableException(
        'No suggestions are available right now.',
      );
    }
    return result;
  }
}
