import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { JwtAuthGuard, type AuthRequest } from '../auth/index.js';
import { LinksService } from './links.service.js';

import { CreateLinkDto } from './dto/create-link.dto.js';
import { UpdateLinkDto } from './dto/update-link.dto.js';

/**
 * CRUD endpoints for a user's saved links. Every route requires a valid JWT.
 * All data is scoped to the authenticated user — no route can read or modify
 * another user's links.
 */
@ApiTags('links')
@ApiBearerAuth()
@Controller('links')
@UseGuards(JwtAuthGuard)
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  /**
   * Saves a URL to the authenticated user's collection. If the URL was
   * previously saved and then read, it is marked as unread and moved
   * to the top of the list rather than creating a duplicate.
   */
  @ApiOperation({ summary: "Save a URL to the current user's collection" })
  @ApiResponse({
    status: 201,
    description:
      'Link created or re-added to the unread list. Metadata fetch queued.',
  })
  @ApiResponse({ status: 400, description: 'URL is not a valid URL.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @Post()
  async create(@Req() request: AuthRequest, @Body() body: CreateLinkDto) {
    const userId = request.user.userId;
    return this.linksService.create(userId, body);
  }

  /**
   * Returns a paginated list of the authenticated user's links.
   * Defaults to page 1 with 10 results. When `search` is provided, full-text
   * search is performed using PostgreSQL `tsvector` — results are ranked by
   * relevance, not recency.
   */
  @ApiOperation({
    summary: 'List links with optional filtering, search, and pagination',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Full-text search term.',
  })
  @ApiQuery({
    name: 'read',
    required: false,
    enum: ['true', 'false'],
    description: 'Filter by read status. Omit to return all.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (1-based). Defaults to 1.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Results per page. Defaults to 10. Max 100.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated result set: { data, total, page, limit }.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @Get()
  async findAll(
    @Req() request: AuthRequest,
    @Query('search') search?: string,
    @Query('read') read?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = request.user.userId;

    // Query params arrive as strings — coerce to typed values before passing
    // to the service, which expects booleans and numbers.
    let readFlag: boolean | undefined;
    if (read === 'true') readFlag = true;
    if (read === 'false') readFlag = false;

    return this.linksService.findAll(userId, {
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
  @ApiOperation({ summary: 'Get a random link from the collection' })
  @ApiQuery({
    name: 'read',
    required: false,
    enum: ['true', 'false'],
    description: 'When true, returns a random read link.',
  })
  @ApiResponse({
    status: 200,
    description: '{ link: Link | null } — null when no links match the filter.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @Get('random')
  async random(@Req() request: AuthRequest, @Query('read') read?: string) {
    const userId = request.user.userId;

    let readFlag = false;
    if (read === 'true') readFlag = true;

    const link = await this.linksService.getRandom(userId, readFlag);
    return { link };
  }

  /** Returns a single link by its UUID, scoped to the authenticated user. */
  @ApiOperation({ summary: 'Get a single link by ID' })
  @ApiParam({ name: 'id', description: 'UUID of the link.' })
  @ApiResponse({
    status: 200,
    description: 'The requested link with its metadata.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 404, description: 'Link not found for this user.' })
  @Get(':id')
  async findOne(@Req() request: AuthRequest, @Param('id') id: string) {
    const userId = request.user.userId;
    return this.linksService.findOne(userId, id);
  }

  /**
   * Updates a link. Currently a no-op — no user-editable fields are defined.
   * The endpoint is wired in advance for future additions.
   */
  @ApiOperation({ summary: 'Update a link (no editable fields yet)' })
  @ApiParam({ name: 'id', description: 'UUID of the link.' })
  @ApiResponse({
    status: 200,
    description: 'The link unchanged (no editable fields defined yet).',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 404, description: 'Link not found for this user.' })
  @Patch(':id')
  async update(
    @Req() request: AuthRequest,
    @Param('id') id: string,
    @Body() body: UpdateLinkDto,
  ) {
    const userId = request.user.userId;
    return this.linksService.update(userId, id, body);
  }

  /** Marks a link as read by setting `readAt` to the current timestamp. */
  @ApiOperation({ summary: 'Mark a link as read' })
  @ApiParam({ name: 'id', description: 'UUID of the link.' })
  @ApiResponse({
    status: 201,
    description: 'The updated link with `readAt` set.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 404, description: 'Link not found for this user.' })
  @Post(':id/read')
  async read(@Req() request: AuthRequest, @Param('id') id: string) {
    const userId = request.user.userId;
    return this.linksService.read(userId, id);
  }

  /** Removes the read timestamp from a link, returning it to the unread list. */
  @ApiOperation({ summary: 'Mark a link as unread' })
  @ApiParam({ name: 'id', description: 'UUID of the link.' })
  @ApiResponse({
    status: 201,
    description: 'The updated link with `readAt` cleared.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 404, description: 'Link not found for this user.' })
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
    description: '{ count: number } — the number of links deleted.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @Delete('read')
  async removeAllRead(@Req() request: AuthRequest) {
    const userId = request.user.userId;
    return this.linksService.removeAllRead(userId);
  }

  /** Permanently deletes a single link by its UUID. */
  @ApiOperation({ summary: 'Permanently delete a single link' })
  @ApiParam({ name: 'id', description: 'UUID of the link.' })
  @ApiResponse({ status: 200, description: '{ success: true }' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 404, description: 'Link not found for this user.' })
  @Delete(':id')
  async remove(@Req() request: AuthRequest, @Param('id') id: string) {
    const userId = request.user.userId;
    return this.linksService.remove(userId, id);
  }
}
