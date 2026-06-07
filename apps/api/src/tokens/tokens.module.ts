import { Module } from '@nestjs/common';

import { BookmarkletTokensService } from './bookmarklet-tokens.service.js';
import { TokensController } from './tokens.controller.js';
import { TokensService } from './tokens.service.js';

@Module({
  controllers: [TokensController],
  exports: [BookmarkletTokensService, TokensService],
  providers: [BookmarkletTokensService, TokensService],
})
export class TokensModule {}
