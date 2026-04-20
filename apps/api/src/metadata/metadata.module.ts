import { Module } from '@nestjs/common';
import { MetadataService } from './metadata.service.js';
import { QueueModule } from '../queue/queue.module.js';

@Module({
  imports: [QueueModule],
  providers: [MetadataService],
  exports: [MetadataService],
})
export class MetadataModule {}
