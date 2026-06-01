import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AccountDeletionController } from './account-deletion.controller.js';
import { UserMfaService } from './user-mfa.service.js';
import { UserOAuthService } from './user-oauth.service.js';
import { UserTokensService } from './user-tokens.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [
    UsersService,
    UserTokensService,
    UserOAuthService,
    UserMfaService,
  ],
  controllers: [UsersController, AccountDeletionController],
  exports: [UsersService, UserTokensService, UserOAuthService, UserMfaService],
})
export class UsersModule {}
