import { EmailQueueService } from './email-queue.service.js';
import { EmailService } from './email.service.js';
import { Module } from '@nestjs/common';

@Module({
  exports: [EmailQueueService, EmailService],
  providers: [EmailQueueService, EmailService],
})
export class EmailModule {}
