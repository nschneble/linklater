import { Module } from '@nestjs/common';
import { UserTokensService } from './user-tokens.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  providers: [UsersService, UserTokensService],
  controllers: [UsersController],
  exports: [UsersService, UserTokensService],
})
export class UsersModule {}
