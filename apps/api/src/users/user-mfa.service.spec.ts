import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { PrismaService } from '../prisma/prisma.service';
import { UserMfaService } from './user-mfa.service';

const USER_ID = 'user-1';
const RECOVERY_CODE = 'aaaaa-bbbbb-ccccc';

describe('UserMfaService', () => {
  let service: UserMfaService;

  const prismaMock = {
    user: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    recoveryCode: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserMfaService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get<UserMfaService>(UserMfaService);
    jest.clearAllMocks();
  });

  describe('verifyAndConsumeRecoveryCode', () => {
    it('consumes the matching code atomically when the bcrypt compare succeeds', async () => {
      const codeId = 'rc-1';
      const codeHash = await bcrypt.hash(RECOVERY_CODE, 1);

      (prismaMock.recoveryCode.findMany as jest.Mock).mockResolvedValue([
        { id: codeId, codeHash },
      ]);
      (prismaMock.recoveryCode.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await expect(
        service.verifyAndConsumeRecoveryCode(USER_ID, RECOVERY_CODE),
      ).resolves.toBeUndefined();

      expect(prismaMock.recoveryCode.updateMany).toHaveBeenCalledWith({
        where: { id: codeId, usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('accepts a hyphenless code by normalizing before bcrypt compare', async () => {
      const codeId = 'rc-1';
      // Stored hash is over the canonical hyphenated form.
      const codeHash = await bcrypt.hash(RECOVERY_CODE, 1);
      const hyphenless = RECOVERY_CODE.replace(/-/g, '');

      (prismaMock.recoveryCode.findMany as jest.Mock).mockResolvedValue([
        { id: codeId, codeHash },
      ]);
      (prismaMock.recoveryCode.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await expect(
        service.verifyAndConsumeRecoveryCode(USER_ID, hyphenless),
      ).resolves.toBeUndefined();
    });

    it('throws UnauthorizedException when the code format cannot be normalized', async () => {
      await expect(
        service.verifyAndConsumeRecoveryCode(USER_ID, 'not-a-recovery-code'),
      ).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.recoveryCode.findMany).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the user has no unused codes', async () => {
      (prismaMock.recoveryCode.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        service.verifyAndConsumeRecoveryCode(USER_ID, RECOVERY_CODE),
      ).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.recoveryCode.updateMany).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when no stored hash matches', async () => {
      const otherHash = await bcrypt.hash('zzzzz-zzzzz-zzzzz', 1);

      (prismaMock.recoveryCode.findMany as jest.Mock).mockResolvedValue([
        { id: 'rc-1', codeHash: otherHash },
      ]);

      await expect(
        service.verifyAndConsumeRecoveryCode(USER_ID, RECOVERY_CODE),
      ).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.recoveryCode.updateMany).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when a concurrent request already consumed the code', async () => {
      const codeId = 'rc-1';
      const codeHash = await bcrypt.hash(RECOVERY_CODE, 1);

      (prismaMock.recoveryCode.findMany as jest.Mock).mockResolvedValue([
        { id: codeId, codeHash },
      ]);
      // Atomic CAS lost the race — another request already marked it used.
      (prismaMock.recoveryCode.updateMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      await expect(
        service.verifyAndConsumeRecoveryCode(USER_ID, RECOVERY_CODE),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('saveTotpSecret', () => {
    it('writes the encrypted secret and clears any prior enabled / verified timestamps', async () => {
      await service.saveTotpSecret(USER_ID, 'encrypted-secret');
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          totpSecret: 'encrypted-secret',
          totpEnabledAt: null,
          totpVerifiedAt: null,
        },
      });
    });
  });

  describe('clearPendingTotpSecret', () => {
    it('clears the pending secret only when totpEnabledAt is still null', async () => {
      await service.clearPendingTotpSecret(USER_ID);
      expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
        where: { id: USER_ID, totpEnabledAt: null },
        data: { totpSecret: null, totpVerifiedAt: null },
      });
    });
  });

  describe('setMfaNonce', () => {
    it('writes the nonce to the user row', async () => {
      await service.setMfaNonce(USER_ID, 'nonce-abc');
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { mfaNonce: 'nonce-abc' },
      });
    });
  });

  describe('clearMfaNonce', () => {
    it('nulls the nonce on the user row', async () => {
      await service.clearMfaNonce(USER_ID);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { mfaNonce: null },
      });
    });
  });

  describe('updateTotpLastUsedStep', () => {
    it('returns true when the atomic CAS advances the step', async () => {
      (prismaMock.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      const result = await service.updateTotpLastUsedStep(USER_ID, 42);
      expect(result).toBe(true);
      expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: USER_ID,
          OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: 42 } }],
        },
        data: { totpLastUsedStep: 42 },
      });
    });

    it('returns false when a parallel verify already advanced the step', async () => {
      (prismaMock.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      const result = await service.updateTotpLastUsedStep(USER_ID, 42);
      expect(result).toBe(false);
    });
  });

  describe('markRecoveryCodeUsed', () => {
    it('returns true when the atomic CAS marks the code used', async () => {
      (prismaMock.recoveryCode.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      const result = await service.markRecoveryCodeUsed('rc-1');
      expect(result).toBe(true);
      expect(prismaMock.recoveryCode.updateMany).toHaveBeenCalledWith({
        where: { id: 'rc-1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('returns false when a parallel verify already consumed the code', async () => {
      (prismaMock.recoveryCode.updateMany as jest.Mock).mockResolvedValue({
        count: 0,
      });
      const result = await service.markRecoveryCodeUsed('rc-1');
      expect(result).toBe(false);
    });
  });

  describe('findUnusedRecoveryCodes', () => {
    it('queries the prisma layer for unused codes scoped to the user', async () => {
      (prismaMock.recoveryCode.findMany as jest.Mock).mockResolvedValue([
        { id: 'rc-1' },
      ]);
      const result = await service.findUnusedRecoveryCodes(USER_ID);
      expect(result).toEqual([{ id: 'rc-1' }]);
      expect(prismaMock.recoveryCode.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, usedAt: null },
      });
    });
  });

  describe('enableTotpWithRecoveryCodes', () => {
    it('runs the user update + recoveryCode delete + insert as a single transaction', async () => {
      const hashes = ['hash-a', 'hash-b'];
      await service.enableTotpWithRecoveryCodes(USER_ID, hashes, 100);
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          totpEnabledAt: expect.any(Date),
          totpVerifiedAt: expect.any(Date),
          totpLastUsedStep: 100,
        },
      });
      expect(prismaMock.recoveryCode.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      expect(prismaMock.recoveryCode.createMany).toHaveBeenCalledWith({
        data: hashes.map((codeHash) => ({ userId: USER_ID, codeHash })),
      });
    });
  });

  describe('reissueRecoveryCodes', () => {
    it('atomically replaces all stored codes inside a single transaction', async () => {
      const hashes = ['new-hash-a', 'new-hash-b'];
      await service.reissueRecoveryCodes(USER_ID, hashes);
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.recoveryCode.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      expect(prismaMock.recoveryCode.createMany).toHaveBeenCalledWith({
        data: hashes.map((codeHash) => ({ userId: USER_ID, codeHash })),
      });
    });
  });

  describe('disableMultiFactor', () => {
    it('clears all TOTP columns and deletes all recovery codes in one transaction', async () => {
      await service.disableMultiFactor(USER_ID);
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: {
          totpSecret: null,
          totpEnabledAt: null,
          totpVerifiedAt: null,
          totpLastUsedStep: null,
        },
      });
      expect(prismaMock.recoveryCode.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
    });
  });
});
