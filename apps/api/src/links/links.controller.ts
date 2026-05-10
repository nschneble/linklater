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
   * previously saved and then archived, it is unarchived and moved to the
   * top of the list rather than creating a duplicate.
   */
  @ApiOperation({ summary: "Save a URL to the current user's collection" })
  @ApiResponse({
    status: 201,
    description:
      'Link created (or resurfaced from archive). Metadata fetch queued.',
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
    name: 'archived',
    required: false,
    enum: ['true', 'false'],
    description: 'Filter by archive status. Omit to return all.',
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
    @Query('archived') archived?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = request.user.userId;

    // Query params arrive as strings — coerce to typed values before passing
    // to the service, which expects booleans and numbers.
    let archivedFlag: boolean | undefined;
    if (archived === 'true') archivedFlag = true;
    if (archived === 'false') archivedFlag = false;

    return this.linksService.findAll(userId, {
      search,
      archived: archivedFlag,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * Opens a random link from the user's collection. When the filter is
   * `active` (the default), the returned link is immediately archived so
   * the same link is not stumbled upon twice in a row.
   *
   * NOTE: `GET /links/random` must be declared before `GET /links/:id`
   * so NestJS does not try to interpret the literal string "random" as an ID.
   */
  @ApiOperation({ summary: 'Get a random link from the collection' })
  @ApiQuery({
    name: 'archived',
    required: false,
    enum: ['true', 'false'],
    description: 'When true, returns a random archived link.',
  })
  @ApiResponse({
    status: 200,
    description: '{ link: Link | null } — null when no links match the filter.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @Get('random')
  async random(
    @Req() request: AuthRequest,
    @Query('archived') archived?: string,
  ) {
    const userId = request.user.userId;

    let archivedFlag = false;
    if (archived === 'true') archivedFlag = true;

    const link = await this.linksService.getRandom(userId, archivedFlag);
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

  /** Marks a link as archived (read) by setting `readAt` to the current timestamp. */
  @ApiOperation({ summary: 'Archive a link (mark as read)' })
  @ApiParam({ name: 'id', description: 'UUID of the link.' })
  @ApiResponse({
    status: 201,
    description: 'The updated link with `readAt` set.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 404, description: 'Link not found for this user.' })
  @Post(':id/archive')
  async archive(@Req() request: AuthRequest, @Param('id') id: string) {
    const userId = request.user.userId;
    return this.linksService.archive(userId, id);
  }

  /** Removes the archive timestamp from a link, returning it to the unread list. */
  @ApiOperation({ summary: 'Unarchive a link (mark as unread)' })
  @ApiParam({ name: 'id', description: 'UUID of the link.' })
  @ApiResponse({
    status: 201,
    description: 'The updated link with `readAt` cleared.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 404, description: 'Link not found for this user.' })
  @Post(':id/unarchive')
  async unarchive(@Req() request: AuthRequest, @Param('id') id: string) {
    const userId = request.user.userId;
    return this.linksService.unarchive(userId, id);
  }

  /**
   * Permanently deletes all archived links for the authenticated user.
   * This is a bulk operation and cannot be undone.
   *
   * NOTE: `DELETE /links/archived` must be declared before `DELETE /links/:id`
   * so NestJS does not interpret the literal string "archived" as an ID.
   */
  @ApiOperation({ summary: 'Permanently delete all archived links' })
  @ApiResponse({
    status: 200,
    description: '{ count: number } — the number of links deleted.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @Delete('archived')
  async removeAllArchived(@Req() request: AuthRequest) {
    const userId = request.user.userId;
    return this.linksService.removeAllArchived(userId);
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
