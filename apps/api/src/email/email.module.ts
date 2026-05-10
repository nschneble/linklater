import { EmailService } from './email.service.js';
import { Module } from '@nestjs/common';

@Module({
  exports: [EmailService],
  providers: [EmailService],
})
export class EmailModule {}
