import { jest } from '@jest/globals';

const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';

// JWT_SECRET must be set before JwtStrategy is imported because the constructor
// reads it eagerly.
process.env.JWT_SECRET = 'test-secret-for-unit-tests';

import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    strategy = new JwtStrategy();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('maps subject to userId and returns userId and email', async () => {
      const result = await strategy.validate({
        email: USER_EMAIL,
        subject: USER_ID,
      });

      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
    });
  });
});
