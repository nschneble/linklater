import { Injectable } from '@nestjs/common';

import { TokensService } from '../tokens/tokens.service.js';

@Injectable()
export class ApiKeyStrategy {
  constructor(private readonly tokensService: TokensService) {}

  async validate(
    rawToken: string,
  ): Promise<{ userId: string; email: string } | null> {
    const user = await this.tokensService.validateToken(rawToken);
    if (!user) {
      return null;
    }
    return { userId: user.id, email: user.email };
  }
}
