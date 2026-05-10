import { Module } from '@nestjs/common';
import { ReadLinkCleanupService } from './read-link-cleanup.service.js';
import { LinksController } from './links.controller.js';
import { LinksService } from './links.service.js';
import { QueueModule } from '../queue/queue.module.js';

@Module({
  imports: [QueueModule],
  providers: [ReadLinkCleanupService, LinksService],
  controllers: [LinksController],
})
export class LinksModule {}
