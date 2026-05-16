import { jest } from '@jest/globals';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { MagicLinkService } from './magic-link.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';

const USER_ID = 'user-1';
const USER_EMAIL = 'user@example.com';
const TOKEN = 'a'.repeat(64);

const makeUser = (overrides = {}) => ({
  id: USER_ID,
  email: USER_EMAIL,
  theme: 'scanner-darkly',
  magicLinkToken: null,
  magicLinkTokenExpiresAt: null,
  ...overrides,
});

describe('MagicLinkService', () => {
  let service: MagicLinkService;

  const usersServiceMock = {
    findByEmail: jest.fn(),
    findByMagicLinkToken: jest.fn(),
    updateMagicLinkToken: jest.fn(),
    clearMagicLinkToken: jest.fn(),
  } as unknown as UsersService;

  const emailServiceMock = {
    sendMagicLink: jest.fn(),
  } as unknown as EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MagicLinkService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: EmailService, useValue: emailServiceMock },
      ],
    }).compile();

    service = module.get<MagicLinkService>(MagicLinkService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestLogin', () => {
    it('generates a token, stores it with expiry, and sends the email', async () => {
      let capturedToken = '';

      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(makeUser());
      (usersServiceMock.updateMagicLinkToken as jest.Mock).mockImplementation(
        async (_id: string, token: string) => {
          capturedToken = token;
        },
      );
      (emailServiceMock.sendMagicLink as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.requestLogin(USER_EMAIL);

      expect(usersServiceMock.findByEmail).toHaveBeenCalledWith(USER_EMAIL);
      expect(usersServiceMock.updateMagicLinkToken).toHaveBeenCalledWith(
        USER_ID,
        expect.stringMatching(/^[0-9a-f]{64}$/),
        expect.any(Date),
      );
      expect(emailServiceMock.sendMagicLink).toHaveBeenCalledWith(
        USER_EMAIL,
        capturedToken,
        'scanner-darkly',
      );
    });

    it('silently returns when the email is not registered', async () => {
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);

      await service.requestLogin('unknown@example.com');

      expect(usersServiceMock.updateMagicLinkToken).not.toHaveBeenCalled();
      expect(emailServiceMock.sendMagicLink).not.toHaveBeenCalled();
    });

    it('stores an expiry approximately 15 minutes in the future', async () => {
      let capturedExpiry: Date | null = null;
      const before = Date.now();

      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(makeUser());
      (usersServiceMock.updateMagicLinkToken as jest.Mock).mockImplementation(
        async (_id: string, _token: string, expiresAt: Date) => {
          capturedExpiry = expiresAt;
        },
      );
      (emailServiceMock.sendMagicLink as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.requestLogin(USER_EMAIL);

      const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
      expect(capturedExpiry!.getTime()).toBeGreaterThanOrEqual(
        before + FIFTEEN_MINUTES_MS - 1000,
      );
      expect(capturedExpiry!.getTime()).toBeLessThanOrEqual(
        before + FIFTEEN_MINUTES_MS + 1000,
      );
    });
  });

  describe('verifyToken', () => {
    it('returns the user and clears the token when valid and not expired', async () => {
      const futureExpiry = new Date(Date.now() + 15 * 60 * 1000);
      const user = makeUser({
        magicLinkToken: TOKEN,
        magicLinkTokenExpiresAt: futureExpiry,
      });

      (usersServiceMock.findByMagicLinkToken as jest.Mock).mockResolvedValue(
        user,
      );
      (usersServiceMock.clearMagicLinkToken as jest.Mock).mockResolvedValue(
        undefined,
      );

      const result = await service.verifyToken(TOKEN);

      expect(usersServiceMock.findByMagicLinkToken).toHaveBeenCalledWith(TOKEN);
      expect(usersServiceMock.clearMagicLinkToken).toHaveBeenCalledWith(
        USER_ID,
      );
      expect(result.id).toBe(USER_ID);
    });

    it('throws BadRequestException when the token is not found', async () => {
      (usersServiceMock.findByMagicLinkToken as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.verifyToken(TOKEN)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the token has expired', async () => {
      const pastExpiry = new Date(Date.now() - 1000);
      const user = makeUser({
        magicLinkToken: TOKEN,
        magicLinkTokenExpiresAt: pastExpiry,
      });

      (usersServiceMock.findByMagicLinkToken as jest.Mock).mockResolvedValue(
        user,
      );

      await expect(service.verifyToken(TOKEN)).rejects.toThrow(
        BadRequestException,
      );
      expect(usersServiceMock.clearMagicLinkToken).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when expiry is missing', async () => {
      const user = makeUser({
        magicLinkToken: TOKEN,
        magicLinkTokenExpiresAt: null,
      });

      (usersServiceMock.findByMagicLinkToken as jest.Mock).mockResolvedValue(
        user,
      );

      await expect(service.verifyToken(TOKEN)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
