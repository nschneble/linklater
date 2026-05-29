import { Module } from '@nestjs/common';
import { MetadataFetcherService } from './metadata-fetcher.service.js';
import { MetadataService } from './metadata.service.js';
import { QueueModule } from '../queue/queue.module.js';

@Module({
  imports: [QueueModule],
  providers: [MetadataFetcherService, MetadataService],
  exports: [MetadataService],
})
export class MetadataModule {}
