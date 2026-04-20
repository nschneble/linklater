import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { LinksModule } from './links/links.module.js';
import { MetadataModule } from './metadata/metadata.module.js';
import { QueueModule } from './queue/queue.module.js';

@Module({
  imports: [PrismaModule, QueueModule, UsersModule, AuthModule, LinksModule, MetadataModule],
})
export class AppModule {}
