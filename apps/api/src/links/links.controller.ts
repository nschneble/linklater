import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { AllowsBookmarkletToken } from '../auth/token-scope.decorator.js';
import { ApiUnauthorized } from '../auth/api-unauthorized.decorator.js';
import { AnyAuthGuard, type AuthRequest } from '../auth/index.js';
import { CustomThrottlerGuard } from '../auth/custom-throttler.guard.js';
import { ThrottleMessage } from '../auth/throttle-message.decorator.js';
import { LinksQueryService } from './links-query.service.js';
import { LinksService } from './links.service.js';

import {
  BulkDeleteResultDto,
  DeleteResultDto,
} from './dto/delete-result.dto.js';
import { CreateLinkDto } from './dto/create-link.dto.js';
import { LinkResponseDto } from './dto/link-response.dto.js';
import { PaginatedLinksResponseDto } from './dto/paginated-links-response.dto.js';
import { RandomLinkResponseDto } from './dto/random-link-response.dto.js';
import { StumbleResponseDto } from './dto/stumble-response.dto.js';

/**
 * CRUD endpoints for a user's saved links. Every route requires a valid JWT
 * or personal access token (PAT). All data is scoped to the authenticated
 * user – no route can read or modify another user's links.
 */
@ApiTags('links')
@ApiBearerAuth('pat')
@Controller('links')
@UseGuards(AnyAuthGuard)
export class LinksController {
  constructor(
    private readonly linksService: LinksService,
    private readonly linksQuery: LinksQueryService,
  ) {}

  /**
   * Saves a URL to the authenticated user's collection. If the URL was
   * previously saved and then read, it is marked as unread and moved
   * to the top of the list rather than creating a duplicate.
   *
   * Rate-limited (60 / minute) because each new distinct URL enqueues an
   * outbound-fetch metadata job; the cap bounds queue growth and outbound-fetch
   * amplification from a scripted session. The route-level `CustomThrottlerGuard`
   * composes with the controller-level `AnyAuthGuard` (both run). Special
   * bookmarklet/API_DOCS tokens remain governed by their tighter per-token
   * limits in `TokenScopeService`; this IP-scoped cap is looser, so it never
   * makes those limits redundant, and it is the only cap for standard sessions.
   */
  @ApiOperation({ summary: "Save a URL to the current user's collection" })
  @ApiResponse({
    status: 201,
    description:
      'The newly saved link. Its metadata is fetched in the background and may not be available on the first response.',
    type: LinkResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Indicates the URL is missing a protocol, points to a private network address, or fails URL parsing, which means it's likely it wasn't a URL at all.",
  })
  @ApiResponse({
    status: 429,
    description: 'Too many links saved in a short window. Try again shortly.',
  })
  @ApiUnauthorized()
  @AllowsBookmarkletToken()
  @UseGuards(CustomThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @ThrottleMessage('Too many links saved')
  @Post()
  async create(@Req() request: AuthRequest, @Body() body: CreateLinkDto) {
    const userId = request.user.userId;
    return this.linksService.create(userId, body);
  }

  /**
   * Returns a paginated list of the authenticated user's links.
   * Defaults to page 1 with 10 results. When `search` is provided, full-text
   * search is performed using PostgreSQL `tsvector` – results are ranked by
   * relevance, not recency.
   */
  @ApiOperation({
    summary: 'List links with optional filtering, search, and pagination',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Diacritic and case-insensitive search over titles, descriptions, and URLs.',
  })
  @ApiQuery({
    name: 'read',
    required: false,
    description:
      'Restrict results to read (true) or unread (false) links. Omit for both.',
    type: Boolean,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number, starting at 1. Defaults to 1.',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Results per page. Defaults to 10. Capped at 100.',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description:
      'One page of links plus the total count, current page, and page size. When search is supplied, results are ordered by relevance; otherwise newest first.',
    type: PaginatedLinksResponseDto,
  })
  @ApiUnauthorized()
  @Get()
  async findAll(
    @Req() request: AuthRequest,
    @Query('search') search?: string,
    @Query('read') read?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = request.user.userId;

    // Query params arrive as strings – coerce to typed values before passing
    // to the service, which expects booleans and numbers.
    let readFlag: boolean | undefined;
    if (read === 'true') readFlag = true;
    if (read === 'false') readFlag = false;

    return this.linksQuery.findAll(userId, {
      search,
      read: readFlag,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * Opens a random link from the user's collection. When the filter is
   * `unread` (the default), the returned link is immediately marked as
   * read so the same link is not stumbled upon twice in a row.
   *
   * NOTE: `GET /links/random` must be declared before `GET /links/:id`
   * so NestJS does not try to interpret the literal string "random" as an ID.
   */
  @ApiOperation({ summary: 'Get a single random link' })
  @ApiQuery({
    name: 'read',
    required: false,
    type: Boolean,
    description:
      "Pick randomly from a user's read (true) or unread (false) links. Defaults to unread.",
  })
  @ApiResponse({
    status: 200,
    description:
      'A randomly chosen link wrapped in a `link` attribute. The link is returned without affecting its read state. `link` is `null` when a random link is unavailable.',
    type: RandomLinkResponseDto,
  })
  @ApiUnauthorized()
  @Get('random')
  async random(@Req() request: AuthRequest, @Query('read') read?: string) {
    const userId = request.user.userId;

    let readFlag = false;
    if (read === 'true') readFlag = true;

    const link = await this.linksQuery.getRandom(userId, readFlag);
    return { link };
  }

  /**
   * Atomically picks a random unread link, marks it as read, and returns
   * its URL so the client can replace the current browser tab. Always
   * returns 200 with `{ url: string | null }`. A null value indicates an
   * empty unread list.
   *
   * NOTE: Declared before `@Get(':id')` so NestJS does not interpret the
   * literal string "stumble" as a link ID.
   */
  @ApiOperation({
    summary: 'Pick a random unread link, mark it read, and return the URL',
  })
  @ApiResponse({
    status: 200,
    description:
      'The URL of the stumbled-upon link, wrapped in a `url` attribute. The link is already marked read by the time the response returns. `url` is null when there are no unread links.',
    type: StumbleResponseDto,
  })
  @ApiUnauthorized()
  @HttpCode(200)
  @Post('stumble')
  async stumble(@Req() request: AuthRequest) {
    const userId = request.user.userId;
    const result = await this.linksQuery.stumble(userId);
    return { url: result?.url ?? null };
  }

  /** Returns a single link by its ID, scoped to the authenticated user. */
  @ApiOperation({ summary: 'Get a single link' })
  @ApiParam({
    name: 'id',
    example: 'clz1xyz456',
  })
  @ApiResponse({
    status: 200,
    description: 'The requested link with its metadata.',
    type: LinkResponseDto,
  })
  @ApiUnauthorized()
  @ApiResponse({ status: 404, description: 'Link not found for this user.' })
  @Get(':id')
  async findOne(@Req() request: AuthRequest, @Param('id') id: string) {
    const userId = request.user.userId;
    return this.linksQuery.findOne(userId, id);
  }

  /** Marks a link as read by setting `readAt` to the current timestamp. */
  @ApiOperation({ summary: 'Mark a link as read' })
  @ApiParam({
    name: 'id',
    example: 'clz1xyz456',
  })
  @ApiResponse({
    status: 200,
    description: 'The updated link with `readAt` set.',
    type: LinkResponseDto,
  })
  @ApiUnauthorized()
  @ApiResponse({ status: 404, description: 'Link not found for this user.' })
  @HttpCode(200)
  @Post(':id/read')
  async read(@Req() request: AuthRequest, @Param('id') id: string) {
    const userId = request.user.userId;
    return this.linksService.read(userId, id);
  }

  /** Removes the read timestamp from a link, returning it to the unread list. */
  @ApiOperation({ summary: 'Mark a link as unread' })
  @ApiParam({
    name: 'id',
    example: 'clz1xyz456',
  })
  @ApiResponse({
    status: 200,
    description: 'The updated link with `readAt` cleared.',
    type: LinkResponseDto,
  })
  @ApiUnauthorized()
  @ApiResponse({ status: 404, description: 'Link not found for this user.' })
  @HttpCode(200)
  @Post(':id/unread')
  async unread(@Req() request: AuthRequest, @Param('id') id: string) {
    const userId = request.user.userId;
    return this.linksService.unread(userId, id);
  }

  /**
   * Permanently deletes all read links for the authenticated user.
   * This is a bulk operation and cannot be undone.
   *
   * NOTE: `DELETE /links/read` must be declared before `DELETE /links/:id`
   * so NestJS does not interpret the literal string "read" as an ID.
   */
  @ApiOperation({ summary: 'Permanently delete all read links' })
  @ApiResponse({
    status: 200,
    description:
      'Confirmation that the links were deleted. Returns the number of links deleted wrapped in a `count` attribute. `count` is 0 when there were no read links to delete.',
    type: BulkDeleteResultDto,
  })
  @ApiUnauthorized()
  @Delete('read')
  async removeAllRead(@Req() request: AuthRequest) {
    const userId = request.user.userId;
    return this.linksService.removeAllRead(userId);
  }

  /** Permanently deletes a single link by its ID. */
  @ApiOperation({ summary: 'Permanently delete a single link' })
  @ApiParam({
    name: 'id',
    example: 'clz1xyz456',
  })
  @ApiResponse({
    status: 200,
    description: 'Confirmation that the link was deleted.',
    type: DeleteResultDto,
  })
  @ApiUnauthorized()
  @ApiResponse({ status: 404, description: 'Link not found for this user.' })
  @Delete(':id')
  async remove(@Req() request: AuthRequest, @Param('id') id: string) {
    const userId = request.user.userId;
    return this.linksService.remove(userId, id);
  }
}
