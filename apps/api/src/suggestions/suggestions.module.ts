import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { RssEntryPruneService } from './rss-entry-prune.service.js';
import { RssFeedService } from './rss-feed.service.js';
import { SuggestionsController } from './suggestions.controller.js';
import { SuggestionsService } from './suggestions.service.js';
import { WikipediaAdapter } from './wikipedia-adapter.js';

@Module({
  imports: [AuthModule, QueueModule],
  providers: [
    RssEntryPruneService,
    RssFeedService,
    SuggestionsService,
    WikipediaAdapter,
  ],
  controllers: [SuggestionsController],
  exports: [SuggestionsService],
})
export class SuggestionsModule {}
