import { jest } from '@jest/globals';

import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { RefreshTokenService } from './refresh-token.service';

const SIGNED_TOKEN = 'signed-token';
const USER_EMAIL = 'email@addy.com';
const USER_ID = 'user-1';

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
    // Invoke the transaction callback with the same mock client so assertions
    // on refreshToken.{delete,create} still match.
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('issueTokenPair', () => {
    it('creates a refresh token row and returns an accessToken and refreshToken', async () => {
      const result = await service.issueTokenPair(USER_ID, USER_EMAIL);

      expect(jwtServiceMock.sign).toHaveBeenCalledWith({
        subject: USER_ID,
        email: USER_EMAIL,
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

    it('expires the refresh token 14 days out to bound a stolen-token window', async () => {
      const before = Date.now();
      await service.issueTokenPair(USER_ID, USER_EMAIL);
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
        user: { id: USER_ID, email: USER_EMAIL },
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
        user: { id: USER_ID, email: USER_EMAIL },
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
        user: { id: USER_ID, email: USER_EMAIL },
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
        user: { id: USER_ID, email: USER_EMAIL },
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
