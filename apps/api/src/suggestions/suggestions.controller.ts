import {
  BadRequestException,
  Controller,
  Get,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AnyAuthGuard } from '../auth/index.js';
import { SuggestionsResponseDto } from './dto/suggestions-response.dto.js';
import { SuggestionsService } from './suggestions.service.js';

const MIN_COUNT = 1;
const MAX_COUNT = 5;

/**
 * Read-only endpoint that powers the Stumble empty state and the unread
 * list's "How about something from {source}?" callout. Picks a random
 * source per call so the same user gets variety across visits.
 *
 * Auth: `AnyAuthGuard` so browser-extension PATs work alongside the web
 * session — when an extension surfaces suggestions inline this endpoint
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
    description: `Number of suggestions to return (default 3, range ${MIN_COUNT}-${MAX_COUNT}).`,
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
    @Query('count') countParameter?: string,
  ): Promise<SuggestionsResponseDto> {
    const count = this.parseCount(countParameter);
    const result = await this.suggestionsService.getSuggestions(count);
    if (!result) {
      throw new ServiceUnavailableException(
        'No suggestions are available right now.',
      );
    }
    return result;
  }

  private parseCount(raw: string | undefined): number {
    if (raw === undefined) return 3;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < MIN_COUNT || parsed > MAX_COUNT) {
      throw new BadRequestException(
        `count must be an integer between ${MIN_COUNT} and ${MAX_COUNT}.`,
      );
    }
    return parsed;
  }
}
