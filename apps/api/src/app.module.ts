import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { LinksModule } from './links/links.module.js';
import { MetadataModule } from './metadata/metadata.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QueueModule } from './queue/queue.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'auth-register', ttl: 60000, limit: 5 },
      { name: 'auth-login', ttl: 60000, limit: 10 },
      { name: 'auth-forgot-password', ttl: 60000, limit: 3 },
      { name: 'auth-reset-password', ttl: 60000, limit: 5 },
      { name: 'auth-verify-email', ttl: 60000, limit: 10 },
      { name: 'auth-resend-verification', ttl: 60000, limit: 5 },
      { name: 'auth-request-email-change', ttl: 60000, limit: 3 },
      { name: 'auth-verify-email-change', ttl: 60000, limit: 10 },
    ]),
    AuthModule,
    LinksModule,
    MetadataModule,
    PrismaModule,
    QueueModule,
    UsersModule,
  ],
})
export class AppModule {}
