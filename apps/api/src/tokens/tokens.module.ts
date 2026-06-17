import { Module } from '@nestjs/common';

import { ApiDocsTokensService } from './api-docs-tokens.service.js';
import { BookmarkletTokensService } from './bookmarklet-tokens.service.js';
import { TokensController } from './tokens.controller.js';
import { TokensService } from './tokens.service.js';

@Module({
  controllers: [TokensController],
  exports: [ApiDocsTokensService, BookmarkletTokensService, TokensService],
  providers: [ApiDocsTokensService, BookmarkletTokensService, TokensService],
})
export class TokensModule {}
