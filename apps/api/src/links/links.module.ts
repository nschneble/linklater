import { Module } from '@nestjs/common';
import { LinksService } from './links.service.js';
import { LinksController } from './links.controller.js';

@Module({
  providers: [LinksService],
  controllers: [LinksController],
})
export class LinksModule {}
