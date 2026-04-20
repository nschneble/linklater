import { Module } from '@nestjs/common';
import { LinksService } from './links.service.js';
import { LinksController } from './links.controller.js';
import { QueueModule } from '../queue/index.js';

@Module({
  imports: [QueueModule],
  providers: [LinksService],
  controllers: [LinksController],
})
export class LinksModule {}
