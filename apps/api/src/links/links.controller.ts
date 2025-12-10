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
import { LinksService } from './links.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('links')
@UseGuards(JwtAuthGuard)
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post()
  async create(
    @Req() req: any,
    @Body() body: { url: string; title?: string; notes?: string },
  ) {
    const userId = req.user.userId;
    return this.linksService.create(userId, body);
  }

  @Get()
  async findAll(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('archived') archived?: string,
  ) {
    const userId = req.user.userId;

    let archivedFlag: boolean | undefined = undefined;
    if (archived === 'true') archivedFlag = true;
    if (archived === 'false') archivedFlag = false;

    return this.linksService.findAll(userId, {
      search,
      archived: archivedFlag,
    });
  }

  @Get('random')
  async random(
    @Req() req: any,
    @Query('archived') archived?: string,
  ) {
    const userId = req.user.userId;

    let archivedFlag = false;
    if (archived === 'true') archivedFlag = true;

    const link = await this.linksService.getRandom(userId, archivedFlag);
    return { link };
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.userId;
    return this.linksService.findOne(userId, id);
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { title?: string; notes?: string },
  ) {
    const userId = req.user.userId;
    return this.linksService.update(userId, id, body);
  }

  @Post(':id/archive')
  async archive(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.userId;
    return this.linksService.archive(userId, id);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.userId;
    return this.linksService.remove(userId, id);
  }
}
