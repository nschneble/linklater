import { AccountDeletionController } from './account-deletion.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { forwardRef, Module } from '@nestjs/common';
import { UserCredentialsService } from './user-credentials.service.js';
import { UserEmailVerificationService } from './user-email-verification.service.js';
import { UserMfaService } from './user-mfa.service.js';
import { UserOAuthService } from './user-oauth.service.js';
import { UsersController } from './users.controller.js';
import { UserSettingsService } from './user-settings.service.js';
import { UsersService } from './users.service.js';
import { UserTokensService } from './user-tokens.service.js';

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [
    UsersService,
    UserCredentialsService,
    UserEmailVerificationService,
    UserSettingsService,
    UserTokensService,
    UserOAuthService,
    UserMfaService,
  ],
  controllers: [UsersController, AccountDeletionController],
  exports: [
    UsersService,
    UserCredentialsService,
    UserEmailVerificationService,
    UserSettingsService,
    UserTokensService,
    UserOAuthService,
    UserMfaService,
  ],
})
export class UsersModule {}
