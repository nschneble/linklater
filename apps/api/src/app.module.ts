import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { LinksModule } from './links/links.module.js';
import { MetadataModule } from './metadata/metadata.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QueueModule } from './queue/queue.module.js';
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
      // MFA login step 2 — tighter window to slow brute-force on OTP codes
      { name: 'auth-verify-otp', ttl: 900000, limit: 5 },
      // MFA setup
      { name: 'auth-mfa-totp-setup', ttl: 60000, limit: 5 },
      { name: 'auth-mfa-email-setup', ttl: 60000, limit: 3 },
      { name: 'auth-mfa-email-verify', ttl: 60000, limit: 5 },
      { name: 'auth-email-resend', ttl: 60000, limit: 3 },
      { name: 'auth-mfa-email-reauth-send', ttl: 60000, limit: 3 },
      // MFA disable — most sensitive action; matches verify-otp window
      { name: 'auth-disable-mfa', ttl: 900000, limit: 5 },
      // Re-auth gate for recovery code operations
      { name: 'auth-reauth', ttl: 900000, limit: 5 },
    ]),
    AuthModule,
    LinksModule,
    MetadataModule,
    PrismaModule,
    QueueModule,
    TokensModule,
    UsersModule,
  ],
})
export class AppModule {}
