import { EmailPreviewController } from './email-preview.controller.js';
import { EmailQueueService } from './email-queue.service.js';
import { EmailService } from './email.service.js';
import { Module } from '@nestjs/common';

@Module({
  controllers: [EmailPreviewController],
  exports: [EmailQueueService],
  providers: [EmailQueueService, EmailService],
})
export class EmailModule {}
