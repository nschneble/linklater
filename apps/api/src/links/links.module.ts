import { Module } from '@nestjs/common';
import { ArchiveCleanupService } from './archive-cleanup.service.js';
import { LinksController } from './links.controller.js';
import { LinksService } from './links.service.js';
import { QueueModule } from '../queue/queue.module.js';

@Module({
  imports: [QueueModule],
  providers: [ArchiveCleanupService, LinksService],
  controllers: [LinksController],
})
export class LinksModule {}
