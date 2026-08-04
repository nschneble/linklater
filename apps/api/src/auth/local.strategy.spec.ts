import { AuthService } from './auth.service';
import { jest } from '@jest/globals';
import { LocalStrategy } from './local.strategy';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';

const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';
const USER_PASSWORD = 'open-sesame';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;

  const authServiceMock = {
    validateUser: jest.fn(),
  } as unknown as AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('returns userId and email when credentials are valid', async () => {
      (authServiceMock.validateUser as jest.Mock).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
      });

      const result = await strategy.validate(USER_EMAIL, USER_PASSWORD);

      expect(result).toEqual({ userId: USER_ID, email: USER_EMAIL });
      expect(authServiceMock.validateUser).toHaveBeenCalledWith(
        USER_EMAIL,
        USER_PASSWORD,
      );
    });

    it('throws UnauthorizedException when credentials are invalid', async () => {
      (authServiceMock.validateUser as jest.Mock).mockResolvedValue(null);

      await expect(
        strategy.validate(USER_EMAIL, 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
