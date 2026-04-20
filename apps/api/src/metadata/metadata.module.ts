import { Module } from '@nestjs/common';
import { MetadataService } from './metadata.service.js';
import { QueueModule } from '../queue/index.js';

@Module({
  imports: [QueueModule],
  providers: [MetadataService],
  exports: [MetadataService],
})
export class MetadataModule {}
