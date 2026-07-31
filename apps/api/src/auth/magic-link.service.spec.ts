import { jest } from '@jest/globals';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { sha256Hex } from '../common/index';
import { MagicLinkService } from './magic-link.service';
import { EmailQueueService } from '../email/email-queue.service';
import { UserTokensService } from '../users/user-tokens.service';
import { UsersService } from '../users/users.service';

const USER_ID = 'user-1';
const USER_EMAIL = 'user@example.com';
const RAW_TOKEN = 'a'.repeat(64);
const TOKEN_HASH = sha256Hex(RAW_TOKEN);

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
    createWithoutPassword: jest.fn(),
    findByEmail: jest.fn(),
    markEmailVerified: jest.fn(),
    verifyEmailAndInvalidateStalePassword: jest.fn(),
  } as unknown as UsersService;

  const userTokensServiceMock = {
    consumeMagicLinkToken: jest.fn(),
    findByMagicLinkToken: jest.fn(),
    updateMagicLinkToken: jest.fn(),
  } as unknown as UserTokensService;

  const emailQueueServiceMock = {
    enqueueMagicLink: jest.fn(),
  } as unknown as EmailQueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MagicLinkService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: UserTokensService, useValue: userTokensServiceMock },
        { provide: EmailQueueService, useValue: emailQueueServiceMock },
      ],
    }).compile();

    service = module.get<MagicLinkService>(MagicLinkService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestLogin', () => {
    it('stores the hash but emails the raw token, and the email value hashes to the stored value', async () => {
      let storedHash = '';

      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(makeUser());
      (
        userTokensServiceMock.updateMagicLinkToken as jest.Mock
      ).mockImplementation(async (_id: string, hash: string) => {
        storedHash = hash;
      });
      (emailQueueServiceMock.enqueueMagicLink as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.requestLogin(USER_EMAIL);

      expect(usersServiceMock.findByEmail).toHaveBeenCalledWith(USER_EMAIL);
      expect(userTokensServiceMock.updateMagicLinkToken).toHaveBeenCalledWith(
        USER_ID,
        expect.stringMatching(/^[0-9a-f]{64}$/),
        expect.any(Date),
      );

      // the email must carry the raw 64-char hex token, NOT the hash
      const sendCall = (emailQueueServiceMock.enqueueMagicLink as jest.Mock)
        .mock.calls[0];
      const emailedToken = sendCall[1] as string;
      expect(emailedToken).toMatch(/^[0-9a-f]{64}$/);
      expect(emailedToken).not.toBe(storedHash);
      // hashing the emailed token must reproduce the stored value
      expect(sha256Hex(emailedToken)).toBe(storedHash);
      expect(sendCall[0]).toBe(USER_EMAIL);
      expect(sendCall[2]).toBe('scanner-darkly');
    });

    it('silently returns when the email is not registered', async () => {
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);

      await service.requestLogin('unknown@example.com');

      expect(userTokensServiceMock.updateMagicLinkToken).not.toHaveBeenCalled();
      expect(emailQueueServiceMock.enqueueMagicLink).not.toHaveBeenCalled();
    });

    it('stores an expiry approximately 15 minutes in the future', async () => {
      let capturedExpiry: Date | null = null;
      const before = Date.now();

      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(makeUser());
      (
        userTokensServiceMock.updateMagicLinkToken as jest.Mock
      ).mockImplementation(
        async (_id: string, _token: string, expiresAt: Date) => {
          capturedExpiry = expiresAt;
        },
      );
      (emailQueueServiceMock.enqueueMagicLink as jest.Mock).mockResolvedValue(
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
    it('looks up the user by the hash of the raw token and clears it on success', async () => {
      const futureExpiry = new Date(Date.now() + 15 * 60 * 1000);
      const user = makeUser({
        emailVerifiedAt: new Date(),
        magicLinkToken: TOKEN_HASH,
        magicLinkTokenExpiresAt: futureExpiry,
      });

      (
        userTokensServiceMock.findByMagicLinkToken as jest.Mock
      ).mockResolvedValue(user);
      (
        userTokensServiceMock.consumeMagicLinkToken as jest.Mock
      ).mockResolvedValue(true);

      const result = await service.verifyToken(RAW_TOKEN);

      expect(userTokensServiceMock.findByMagicLinkToken).toHaveBeenCalledWith(
        TOKEN_HASH,
      );
      expect(userTokensServiceMock.consumeMagicLinkToken).toHaveBeenCalledWith(
        USER_ID,
        TOKEN_HASH,
      );
      expect(result.id).toBe(USER_ID);
    });

    it('throws when a parallel click already consumed the token', async () => {
      const futureExpiry = new Date(Date.now() + 15 * 60 * 1000);
      const user = makeUser({
        emailVerifiedAt: new Date(),
        magicLinkToken: TOKEN_HASH,
        magicLinkTokenExpiresAt: futureExpiry,
      });

      (
        userTokensServiceMock.findByMagicLinkToken as jest.Mock
      ).mockResolvedValue(user);
      (
        userTokensServiceMock.consumeMagicLinkToken as jest.Mock
      ).mockResolvedValue(false);

      await expect(service.verifyToken(RAW_TOKEN)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the token is not found', async () => {
      (
        userTokensServiceMock.findByMagicLinkToken as jest.Mock
      ).mockResolvedValue(null);

      await expect(service.verifyToken(RAW_TOKEN)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the token has expired', async () => {
      const pastExpiry = new Date(Date.now() - 1000);
      const user = makeUser({
        magicLinkToken: TOKEN_HASH,
        magicLinkTokenExpiresAt: pastExpiry,
      });

      (
        userTokensServiceMock.findByMagicLinkToken as jest.Mock
      ).mockResolvedValue(user);

      await expect(service.verifyToken(RAW_TOKEN)).rejects.toThrow(
        BadRequestException,
      );
      expect(
        userTokensServiceMock.consumeMagicLinkToken,
      ).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when expiry is missing', async () => {
      const user = makeUser({
        magicLinkToken: TOKEN_HASH,
        magicLinkTokenExpiresAt: null,
      });

      (
        userTokensServiceMock.findByMagicLinkToken as jest.Mock
      ).mockResolvedValue(user);

      await expect(service.verifyToken(RAW_TOKEN)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('invalidates a stale password when the user email is not yet verified', async () => {
      const futureExpiry = new Date(Date.now() + 15 * 60 * 1000);
      const user = makeUser({
        emailVerifiedAt: null,
        magicLinkToken: TOKEN_HASH,
        magicLinkTokenExpiresAt: futureExpiry,
      });

      (
        userTokensServiceMock.findByMagicLinkToken as jest.Mock
      ).mockResolvedValue(user);
      (
        userTokensServiceMock.consumeMagicLinkToken as jest.Mock
      ).mockResolvedValue(true);
      (
        usersServiceMock.verifyEmailAndInvalidateStalePassword as jest.Mock
      ).mockResolvedValue(undefined);

      await service.verifyToken(RAW_TOKEN);

      expect(
        usersServiceMock.verifyEmailAndInvalidateStalePassword,
      ).toHaveBeenCalledWith(USER_ID);
      expect(usersServiceMock.markEmailVerified).not.toHaveBeenCalled();
    });

    it('does not invalidate the password when the email is already verified', async () => {
      const futureExpiry = new Date(Date.now() + 15 * 60 * 1000);
      const user = makeUser({
        emailVerifiedAt: new Date(),
        magicLinkToken: TOKEN_HASH,
        magicLinkTokenExpiresAt: futureExpiry,
      });

      (
        userTokensServiceMock.findByMagicLinkToken as jest.Mock
      ).mockResolvedValue(user);
      (
        userTokensServiceMock.consumeMagicLinkToken as jest.Mock
      ).mockResolvedValue(true);

      await service.verifyToken(RAW_TOKEN);

      expect(
        usersServiceMock.verifyEmailAndInvalidateStalePassword,
      ).not.toHaveBeenCalled();
    });
  });

  describe('requestSignup', () => {
    it('creates a new user and sends a magic link when the email is not registered', async () => {
      const createdUser = {
        id: USER_ID,
        email: USER_EMAIL,
        theme: 'scanner-darkly',
        passwordHash: null,
      };

      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.createWithoutPassword as jest.Mock).mockResolvedValue(
        createdUser,
      );
      (
        userTokensServiceMock.updateMagicLinkToken as jest.Mock
      ).mockResolvedValue(undefined);
      (emailQueueServiceMock.enqueueMagicLink as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.requestSignup(USER_EMAIL);

      expect(usersServiceMock.createWithoutPassword).toHaveBeenCalledWith(
        USER_EMAIL,
      );
      expect(userTokensServiceMock.updateMagicLinkToken).toHaveBeenCalledWith(
        USER_ID,
        expect.stringMatching(/^[0-9a-f]{64}$/),
        expect.any(Date),
      );
      expect(emailQueueServiceMock.enqueueMagicLink).toHaveBeenCalledWith(
        USER_EMAIL,
        expect.any(String),
        'scanner-darkly',
      );
    });

    it('sends a magic link to an existing user without creating a new one', async () => {
      const existingUser = makeUser();

      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(
        existingUser,
      );
      (
        userTokensServiceMock.updateMagicLinkToken as jest.Mock
      ).mockResolvedValue(undefined);
      (emailQueueServiceMock.enqueueMagicLink as jest.Mock).mockResolvedValue(
        undefined,
      );

      await service.requestSignup(USER_EMAIL);

      expect(usersServiceMock.createWithoutPassword).not.toHaveBeenCalled();
      expect(userTokensServiceMock.updateMagicLinkToken).toHaveBeenCalledWith(
        USER_ID,
        expect.any(String),
        expect.any(Date),
      );
      expect(emailQueueServiceMock.enqueueMagicLink).toHaveBeenCalled();
    });

    it('silently returns when account creation returns null (race condition)', async () => {
      (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);
      (usersServiceMock.createWithoutPassword as jest.Mock).mockResolvedValue(
        null,
      );

      await service.requestSignup(USER_EMAIL);

      expect(userTokensServiceMock.updateMagicLinkToken).not.toHaveBeenCalled();
      expect(emailQueueServiceMock.enqueueMagicLink).not.toHaveBeenCalled();
    });
  });
});
