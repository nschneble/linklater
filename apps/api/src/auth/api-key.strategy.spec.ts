import { jest } from '@jest/globals';

import { ApiKeyStrategy } from './api-key.strategy';
import { TokensService } from '../tokens/tokens.service';

const USER_ID = 'user-1';
const USER_EMAIL = 'user@example.com';

describe('ApiKeyStrategy', () => {
  let strategy: ApiKeyStrategy;

  const tokensServiceMock = {
    validateToken: jest.fn(),
  } as unknown as TokensService;

  beforeEach(() => {
    strategy = new ApiKeyStrategy(tokensServiceMock);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('returns the validated token payload (userId, email, kind, tokenHash) when token matches', async () => {
      const user = { id: USER_ID, email: USER_EMAIL };
      (tokensServiceMock.validateToken as jest.Mock).mockResolvedValue({
        user,
        kind: 'USER',
        tokenHash: 'abc123hash',
      });

      const result = await strategy.validate('ltk_somerawtoken');

      expect(result).toEqual({
        userId: USER_ID,
        email: USER_EMAIL,
        kind: 'USER',
        tokenHash: 'abc123hash',
      });
    });

    it('returns null when token does not match', async () => {
      (tokensServiceMock.validateToken as jest.Mock).mockResolvedValue(null);

      const result = await strategy.validate('ltk_badtoken');

      expect(result).toBeNull();
    });
  });
});
