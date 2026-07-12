import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { LinksModule } from './links/links.module.js';
import { MetadataModule } from './metadata/metadata.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QueueModule } from './queue/queue.module.js';
import { SuggestionsModule } from './suggestions/suggestions.module.js';
import { TokensModule } from './tokens/tokens.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'auth-register', ttl: 60000, limit: 5 },
      { name: 'auth-login', ttl: 60000, limit: 10 },
      { name: 'auth-forgot-password', ttl: 60000, limit: 3 },
      { name: 'auth-reset-password', ttl: 60000, limit: 5 },
      { name: 'auth-verify-email', ttl: 60000, limit: 10 },
      { name: 'auth-resend-verification', ttl: 60000, limit: 3 },
      { name: 'auth-request-email-change', ttl: 60000, limit: 3 },
      { name: 'auth-verify-email-change', ttl: 60000, limit: 10 },
      // MFA login step 2 – tighter window to slow brute-force on OTP codes
      { name: 'auth-verify-otp', ttl: 900000, limit: 5 },
      // MFA setup
      { name: 'auth-mfa-totp-setup', ttl: 60000, limit: 5 },
      // MFA disable – most sensitive action; matches verify-otp window
      { name: 'auth-disable-mfa', ttl: 900000, limit: 5 },
      // Re-auth gate for recovery code operations
      { name: 'auth-reauth', ttl: 900000, limit: 5 },
      // PAT creation – JWT-gated, so no brute-force vector, but caps a
      // compromised or runaway session from spamming token rows (20 / hour)
      { name: 'token-create', ttl: 3600000, limit: 20 },
    ]),
    AuthModule,
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
