import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { LinksModule } from './links/links.module.js';
import { MetadataModule } from './metadata/metadata.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QueueModule } from './queue/queue.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    AuthModule,
    LinksModule,
    MetadataModule,
    PrismaModule,
    QueueModule,
    UsersModule,
  ],
})
export class AppModule {}
