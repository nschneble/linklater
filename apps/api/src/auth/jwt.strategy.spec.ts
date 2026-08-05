import { jest } from '@jest/globals';

const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';

// JWT_SECRET must be set before importing JwtStrategy (eager constructor)
process.env.JWT_SECRET = 'test-secret-for-unit-tests';

import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const prismaServiceMock = {
    user: {
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    strategy = new JwtStrategy(prismaServiceMock);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('throws when JWT_SECRET is not set', () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    try {
      expect(() => new JwtStrategy(prismaServiceMock)).toThrow(
        'JWT_SECRET must be set',
      );
    } finally {
      process.env.JWT_SECRET = original;
    }
  });

  describe('validate', () => {
    it('maps subject to userId and returns userId and email when tokenVersion matches', async () => {
      (prismaServiceMock.user.findUnique as jest.Mock).mockResolvedValue({
        tokenVersion: 0,
      });

      const result = await strategy.validate({
        email: USER_EMAIL,
        subject: USER_ID,
        tokenVersion: 0,
      });

      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
    });

    it('treats a missing tokenVersion claim as 0, matching the column default', async () => {
      (prismaServiceMock.user.findUnique as jest.Mock).mockResolvedValue({
        tokenVersion: 0,
      });

      const result = await strategy.validate({
        email: USER_EMAIL,
        subject: USER_ID,
      });

      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
    });

    it('rejects a token whose tokenVersion is stale', async () => {
      (prismaServiceMock.user.findUnique as jest.Mock).mockResolvedValue({
        tokenVersion: 1,
      });

      const result = await strategy.validate({
        email: USER_EMAIL,
        subject: USER_ID,
        tokenVersion: 0,
      });

      expect(result).toBeNull();
    });

    it('rejects a token for a user that no longer exists', async () => {
      (prismaServiceMock.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await strategy.validate({
        email: USER_EMAIL,
        subject: USER_ID,
        tokenVersion: 0,
      });

      expect(result).toBeNull();
    });
  });
});
