import { Module, forwardRef, type Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { ApiKeyStrategy } from './api-key.strategy.js';
import { AnyAuthGuard } from './any-auth.guard.js';
import { AppleStrategy } from './apple.strategy.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { ExtensionAuthController } from './extension-auth.controller.js';
import { ExtensionAuthService } from './extension-auth.service.js';
import { MagicLinkController } from './magic-link.controller.js';
import { MagicLinkService } from './magic-link.service.js';
import { OAuthAccountService } from './oauth-account.service.js';
import { OAuthController } from './oauth.controller.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { GoogleLinkStrategy } from './google-link.strategy.js';
import { GoogleStrategy } from './google.strategy.js';
import { JwtStrategy } from './jwt.strategy.js';
import { LocalStrategy } from './local.strategy.js';
import { MfaAuthGuard } from './mfa-auth.guard.js';
import { TotpService } from './totp.service.js';
import { MultiFactorController } from './multi-factor.controller.js';
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
      signOptions: { expiresIn: '1h' },
    }),
    PassportModule,
    TokensModule,
    forwardRef(() => UsersModule),
  ],
  providers: [
    ApiKeyStrategy,
    AnyAuthGuard,
    AuthService,
    EmailVerificationService,
    ExtensionAuthService,
    MagicLinkService,
    OAuthAccountService,
    RefreshTokenService,
    JwtStrategy,
    LocalStrategy,
    MfaAuthGuard,
    TotpService,
    ...oauthProviders,
  ],
  controllers: [
    AuthController,
    ExtensionAuthController,
    MagicLinkController,
    OAuthController,
    MultiFactorController,
  ],
  exports: [AnyAuthGuard, AuthService],
})
export class AuthModule {}
