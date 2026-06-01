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
    recoveryCode: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
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
});
