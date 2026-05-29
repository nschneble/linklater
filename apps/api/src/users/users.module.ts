import { Module } from '@nestjs/common';
import { UserMfaService } from './user-mfa.service.js';
import { UserOAuthService } from './user-oauth.service.js';
import { UserTokensService } from './user-tokens.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  providers: [UsersService, UserTokensService, UserOAuthService, UserMfaService],
  controllers: [UsersController],
  exports: [UsersService, UserTokensService],
})
export class UsersModule {}
