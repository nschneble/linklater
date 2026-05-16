import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { LinksController } from './links.controller.js';
import { LinksService } from './links.service.js';
import { ReadLinkCleanupService } from './read-link-cleanup.service.js';

@Module({
  imports: [AuthModule, QueueModule],
  providers: [LinksService, ReadLinkCleanupService],
  controllers: [LinksController],
})
export class LinksModule {}
