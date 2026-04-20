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
import { LinksService } from './links.service.js';
import { JwtAuthGuard, type AuthRequest } from '@linklater/auth';
import { CreateLinkDto } from './dto/create-link.dto.js';
import { UpdateLinkDto } from './dto/update-link.dto.js';

@Controller('links')
@UseGuards(JwtAuthGuard)
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post()
  async create(@Req() req: AuthRequest, @Body() body: CreateLinkDto) {
    const userId = req.user.userId;
    return this.linksService.create(userId, body);
  }

  @Get()
  async findAll(
    @Req() req: AuthRequest,
    @Query('search') search?: string,
    @Query('archived') archived?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user.userId;

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

  @Get('random')
  async random(@Req() req: AuthRequest, @Query('archived') archived?: string) {
    const userId = req.user.userId;

    let archivedFlag = false;
    if (archived === 'true') archivedFlag = true;

    const link = await this.linksService.getRandom(userId, archivedFlag);
    return { link };
  }

  @Get(':id')
  async findOne(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user.userId;
    return this.linksService.findOne(userId, id);
  }

  @Patch(':id')
  async update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: UpdateLinkDto,
  ) {
    const userId = req.user.userId;
    return this.linksService.update(userId, id, body);
  }

  @Post(':id/archive')
  async archive(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user.userId;
    return this.linksService.archive(userId, id);
  }

  @Post(':id/unarchive')
  async unarchive(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user.userId;
    return this.linksService.unarchive(userId, id);
  }

  @Delete(':id')
  async remove(@Req() req: AuthRequest, @Param('id') id: string) {
    const userId = req.user.userId;
    return this.linksService.remove(userId, id);
  }
}
