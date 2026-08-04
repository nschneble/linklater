import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { LinksController } from './links.controller.js';
import { LinksQueryService } from './links-query.service.js';
import { LinksService } from './links.service.js';
import { QueueModule } from '../queue/queue.module.js';
import { ReadLinkCleanupService } from './read-link-cleanup.service.js';

@Module({
  imports: [AuthModule, QueueModule],
  providers: [LinksQueryService, LinksService, ReadLinkCleanupService],
  controllers: [LinksController],
})
export class LinksModule {}
