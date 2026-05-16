import { Module, type Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { ApiKeyStrategy } from './api-key.strategy.js';
import { AnyAuthGuard } from './any-auth.guard.js';
import { AppleStrategy } from './apple.strategy.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { MagicLinkService } from './magic-link.service.js';
import { GoogleLinkStrategy } from './google-link.strategy.js';
import { GoogleStrategy } from './google.strategy.js';
import { JwtStrategy } from './jwt.strategy.js';
import { LocalStrategy } from './local.strategy.js';
import { MfaAuthGuard } from './mfa-auth.guard.js';
import { TotpService } from './totp.service.js';
import { EmailModule } from '../email/email.module.js';
import { TokensModule } from '../tokens/tokens.module.js';
import { UsersModule } from '../users/users.module.js';

const googleEnabled = !!(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CALLBACK_URL
);

const googleLinkEnabled = !!(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_LINK_CALLBACK_URL
);

const appleEnabled = !!(
  process.env.APPLE_CLIENT_ID &&
  process.env.APPLE_TEAM_ID &&
  process.env.APPLE_KEY_ID &&
  process.env.APPLE_PRIVATE_KEY &&
  process.env.APPLE_CALLBACK_URL
);

const oauthProviders: Provider[] = [
  ...(googleEnabled ? [GoogleStrategy] : []),
  ...(googleLinkEnabled ? [GoogleLinkStrategy] : []),
  ...(appleEnabled ? [AppleStrategy] : []),
];

@Module({
  imports: [
    EmailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '90d' },
    }),
    PassportModule,
    TokensModule,
    UsersModule,
  ],
  providers: [
    ApiKeyStrategy,
    AnyAuthGuard,
    AuthService,
    MagicLinkService,
    JwtStrategy,
    LocalStrategy,
    MfaAuthGuard,
    TotpService,
    ...oauthProviders,
  ],
  controllers: [AuthController],
  exports: [AnyAuthGuard],
})
export class AuthModule {}
