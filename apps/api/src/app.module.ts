import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { LinksModule } from './links/links.module.js';
import { MetadataModule } from './metadata/metadata.module.js';
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { QueueModule } from './queue/queue.module.js';
import { SuggestionsModule } from './suggestions/suggestions.module.js';
import { THROTTLER_CONFIG } from './throttler.config.js';
import { ThrottlerModule } from '@nestjs/throttler';
import { TokensModule } from './tokens/tokens.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot(THROTTLER_CONFIG),
    AuthModule,
    HealthModule,
    LinksModule,
    MetadataModule,
    PrismaModule,
    QueueModule,
    SuggestionsModule,
    TokensModule,
    UsersModule,
  ],
})
export class AppModule {}
