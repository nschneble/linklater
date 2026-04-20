import { Module } from '@nestjs/common';
import { AuthModule } from './auth/index.js';
import { LinksModule } from './links/index.js';
import { MetadataModule } from './metadata/index.js';
import { PrismaModule } from './prisma/index.js';
import { QueueModule } from './queue/index.js';
import { UsersModule } from './users/index.js';

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
