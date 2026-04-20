import { Module } from '@nestjs/common';
import { LinksController } from './links.controller.js';
import { LinksService } from './links.service.js';
import { QueueModule } from '../queue/queue.module.js';

@Module({
  imports: [QueueModule],
  providers: [LinksService],
  controllers: [LinksController],
})
export class LinksModule {}
