import { jest } from '@jest/globals';

import { JwtService } from '@nestjs/jwt';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { RefreshTokenService } from './refresh-token.service';

const REJECTION_PREFIX = 'Refresh rejected: ';
const SIGNED_TOKEN = 'signed-token';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';

const warnedLines = () =>
  (Logger.prototype.warn as unknown as jest.Mock).mock.calls.map((call) =>
    String(call[0] as unknown),
  );

const rejectionReasonsLogged = () =>
  warnedLines()
    .filter((line) => line.startsWith(REJECTION_PREFIX))
    .map((line) => line.slice(REJECTION_PREFIX.length));

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;

  const jwtServiceMock = {
    sign: jest.fn().mockReturnValue(SIGNED_TOKEN),
  } as unknown as JwtService;

  const prismaServiceMock = {
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
    extensionAuthCode: {
      deleteMany: jest.fn().mockResolvedValue({}),
    },
    // run the transaction callback with the same mock so assertions match
    $transaction: jest
      .fn()
      .mockImplementation(
        async (
          callback: (transaction: typeof prismaServiceMock) => Promise<unknown>,
        ) => callback(prismaServiceMock),
      ),
  } as unknown as PrismaService & {
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: PrismaService, useValue: prismaServiceMock },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
    jest.clearAllMocks();
    // rejection-path tests exercise the warn branch on purpose; keep it quiet
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('issueTokenPair', () => {
    it('creates a refresh token row and returns an accessToken and refreshToken', async () => {
      const result = await service.issueTokenPair(USER_ID, USER_EMAIL, 0);

      expect(jwtServiceMock.sign).toHaveBeenCalledWith({
        subject: USER_ID,
        email: USER_EMAIL,
        tokenVersion: 0,
      });
      expect(prismaServiceMock.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: USER_ID }),
        }),
      );
      expect(result).toHaveProperty('accessToken', SIGNED_TOKEN);
      expect(result).toHaveProperty('refreshToken');
      expect(typeof result.refreshToken).toBe('string');
    });

    it('signs the current tokenVersion so a later bump invalidates this token', async () => {
      await service.issueTokenPair(USER_ID, USER_EMAIL, 3);

      expect(jwtServiceMock.sign).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: 3 }),
      );
    });

    it('expires the refresh token 14 days out to bound a stolen-token window', async () => {
      const before = Date.now();
      await service.issueTokenPair(USER_ID, USER_EMAIL, 0);
      const after = Date.now();

      const createCall = (prismaServiceMock.refreshToken.create as jest.Mock)
        .mock.calls[0][0] as { data: { expiresAt: Date } };
      const lifetimeMs = createCall.data.expiresAt.getTime() - before;

      const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
      const elapsedMs = after - before;
      expect(lifetimeMs).toBeGreaterThanOrEqual(fourteenDaysMs);
      expect(lifetimeMs).toBeLessThanOrEqual(fourteenDaysMs + elapsedMs + 1000);
    });
  });

  describe('refresh', () => {
    const RAW_REFRESH_TOKEN = 'a'.repeat(64);

    it('returns a new token pair when the refresh token is valid', async () => {
      (
        prismaServiceMock.refreshToken.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'rt-1',
        userId: USER_ID,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        user: { id: USER_ID, email: USER_EMAIL, tokenVersion: 0 },
      });

      (
        prismaServiceMock.refreshToken.deleteMany as jest.Mock
      ).mockResolvedValueOnce({ count: 1 });

      const result = await service.refresh(RAW_REFRESH_TOKEN);

      expect(
        (prismaServiceMock as unknown as { $transaction: jest.Mock })
          .$transaction,
      ).toHaveBeenCalledTimes(1);
      expect(prismaServiceMock.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { id: 'rt-1', tokenHash: expect.any(String) },
      });
      expect(prismaServiceMock.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: USER_ID }),
        }),
      );
      expect(result).toHaveProperty('accessToken', SIGNED_TOKEN);
      expect(result).toHaveProperty('refreshToken');
    });

    it('throws UnauthorizedException (not 500) when a concurrent refresh already deleted the row', async () => {
      (
        prismaServiceMock.refreshToken.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'rt-1',
        userId: USER_ID,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        user: { id: USER_ID, email: USER_EMAIL, tokenVersion: 0 },
      });
      (
        prismaServiceMock.refreshToken.deleteMany as jest.Mock
      ).mockResolvedValueOnce({ count: 0 });

      await expect(service.refresh(RAW_REFRESH_TOKEN)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prismaServiceMock.refreshToken.create).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the refresh token is not found', async () => {
      (
        prismaServiceMock.refreshToken.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(service.refresh(RAW_REFRESH_TOKEN)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the refresh token is expired', async () => {
      (
        prismaServiceMock.refreshToken.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'rt-1',
        userId: USER_ID,
        expiresAt: new Date(Date.now() - 1000),
        user: { id: USER_ID, email: USER_EMAIL, tokenVersion: 0 },
      });

      await expect(service.refresh(RAW_REFRESH_TOKEN)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('propagates failure from the create half of the rotation so prisma rolls back the delete', async () => {
      (
        prismaServiceMock.refreshToken.findUnique as jest.Mock
      ).mockResolvedValue({
        id: 'rt-1',
        userId: USER_ID,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        user: { id: USER_ID, email: USER_EMAIL, tokenVersion: 0 },
      });
      (
        prismaServiceMock.refreshToken.deleteMany as jest.Mock
      ).mockResolvedValueOnce({ count: 1 });
      (
        prismaServiceMock.refreshToken.create as jest.Mock
      ).mockRejectedValueOnce(new Error('db down'));

      await expect(service.refresh(RAW_REFRESH_TOKEN)).rejects.toThrow(
        'db down',
      );
    });

    describe('rejection reason codes', () => {
      const REJECTED_RESPONSE = {
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
        statusCode: 401,
      };

      const arrangeStoredToken = (expiresAt: Date) => {
        (
          prismaServiceMock.refreshToken.findUnique as jest.Mock
        ).mockResolvedValue({
          id: 'rt-1',
          userId: USER_ID,
          expiresAt,
          user: { id: USER_ID, email: USER_EMAIL, tokenVersion: 0 },
        });
      };

      const arrangeUnknownToken = () => {
        (
          prismaServiceMock.refreshToken.findUnique as jest.Mock
        ).mockResolvedValue(null);
      };

      const arrangeExpiredToken = () => {
        arrangeStoredToken(new Date(Date.now() - 1000));
      };

      const arrangeRotationRace = () => {
        arrangeStoredToken(new Date(Date.now() + 60 * 60 * 1000));
        (
          prismaServiceMock.refreshToken.deleteMany as jest.Mock
        ).mockResolvedValueOnce({ count: 0 });
      };

      const rejectionOfRefresh = async () => {
        try {
          await service.refresh(RAW_REFRESH_TOKEN);
        } catch (error) {
          return error as UnauthorizedException;
        }
        throw new Error('refresh resolved where a rejection was expected');
      };

      const presentedTokenHash = () =>
        (
          (prismaServiceMock.refreshToken.findUnique as jest.Mock).mock
            .calls[0][0] as { where: { tokenHash: string } }
        ).where.tokenHash;

      it('reports unknown-token when no stored row matches the hash', async () => {
        arrangeUnknownToken();

        await expect(service.refresh(RAW_REFRESH_TOKEN)).rejects.toThrow(
          UnauthorizedException,
        );

        expect(rejectionReasonsLogged()).toEqual(['unknown-token']);
      });

      it('reports expired when the matched row had already lapsed', async () => {
        arrangeExpiredToken();

        await expect(service.refresh(RAW_REFRESH_TOKEN)).rejects.toThrow(
          UnauthorizedException,
        );

        expect(rejectionReasonsLogged()).toEqual(['expired']);
      });

      it('reports rotation-race when a concurrent refresh won the delete', async () => {
        arrangeRotationRace();

        await expect(service.refresh(RAW_REFRESH_TOKEN)).rejects.toThrow(
          UnauthorizedException,
        );

        expect(rejectionReasonsLogged()).toEqual(['rotation-race']);
      });

      it('stays silent when the refresh succeeds', async () => {
        arrangeStoredToken(new Date(Date.now() + 60 * 60 * 1000));
        (
          prismaServiceMock.refreshToken.deleteMany as jest.Mock
        ).mockResolvedValueOnce({ count: 1 });

        await service.refresh(RAW_REFRESH_TOKEN);

        expect(warnedLines()).toEqual([]);
      });

      it('answers every arm with a response a caller cannot tell apart', async () => {
        arrangeUnknownToken();
        const unknownToken = await rejectionOfRefresh();
        arrangeExpiredToken();
        const expired = await rejectionOfRefresh();
        arrangeRotationRace();
        const rotationRace = await rejectionOfRefresh();

        for (const rejection of [unknownToken, expired, rotationRace]) {
          expect(rejection).toBeInstanceOf(UnauthorizedException);
          expect(rejection.getStatus()).toBe(401);
          expect(rejection.getResponse()).toEqual(REJECTED_RESPONSE);
        }
      });

      it('keeps the token, its hash, and the account out of every line', async () => {
        arrangeUnknownToken();
        await rejectionOfRefresh();
        arrangeExpiredToken();
        await rejectionOfRefresh();
        arrangeRotationRace();
        await rejectionOfRefresh();

        const emitted = warnedLines().join('\n');
        for (const secret of [
          RAW_REFRESH_TOKEN,
          presentedTokenHash(),
          USER_EMAIL,
          USER_ID,
        ]) {
          expect(emitted).not.toContain(secret);
        }
        expect(rejectionReasonsLogged()).toHaveLength(3);
      });
    });
  });

  describe('revokeAllRefreshTokens', () => {
    it('deletes all refresh tokens and extension auth codes for the user', async () => {
      (
        prismaServiceMock.refreshToken.deleteMany as jest.Mock
      ).mockResolvedValue({ count: 2 });
      (
        prismaServiceMock.extensionAuthCode.deleteMany as jest.Mock
      ).mockResolvedValue({ count: 1 });

      await service.revokeAllRefreshTokens(USER_ID);

      expect(prismaServiceMock.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      expect(
        prismaServiceMock.extensionAuthCode.deleteMany,
      ).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
    });
  });
});
