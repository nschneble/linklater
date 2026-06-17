import { jest } from '@jest/globals';

class MockPrismaClientKnownRequestError extends Error {
  code: string;
  constructor(message: string, { code }: { code: string }) {
    super(message);
    this.code = code;
  }
}

jest.mock('../prisma/generated/client', () => ({
  Prisma: { PrismaClientKnownRequestError: MockPrismaClientKnownRequestError },
}));

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { TokensService } from './tokens.service';

const makeP2025 = () =>
  new (
    Prisma as {
      PrismaClientKnownRequestError: typeof MockPrismaClientKnownRequestError;
    }
  ).PrismaClientKnownRequestError('Record not found', { code: 'P2025' });

const TOKEN_ID = 'token-1';
const USER_ID = 'user-1';
const TOKEN_NAME = 'My Extension';

const makeApiToken = (overrides = {}) => ({
  id: TOKEN_ID,
  name: TOKEN_NAME,
  prefix: 'ltk_aBcDeFgH',
  tokenHash: 'abc123hash',
  userId: USER_ID,
  lastUsedAt: null,
  createdAt: new Date('2026-01-01'),
  ...overrides,
});

describe('TokensService', () => {
  let service: TokensService;

  const prismaMock = {
    apiToken: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokensService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<TokensService>(TokensService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('generates a ltk_-prefixed token, stores a hash and 12-char prefix, returns stored fields plus rawToken', async () => {
      const stored = makeApiToken();
      (prismaMock.apiToken.create as jest.Mock).mockResolvedValue(stored);

      const result = await service.create(USER_ID, TOKEN_NAME);

      expect(result.rawToken).toMatch(/^ltk_/);
      const callArgs = (prismaMock.apiToken.create as jest.Mock).mock
        .calls[0][0] as { data: { tokenHash: string; prefix: string } };
      expect(callArgs.data.tokenHash).not.toBe(result.rawToken);
      expect(callArgs.data.prefix).toBe(result.rawToken.slice(0, 12));
      expect(result.id).toBe(stored.id);
      expect(result.name).toBe(stored.name);
      expect(result.createdAt).toBe(stored.createdAt);
      expect(result.lastUsedAt).toBe(stored.lastUsedAt);
    });
  });

  describe('findAll', () => {
    it('returns tokens without tokenHash', async () => {
      const tokens = [makeApiToken(), makeApiToken({ id: 'token-2' })];
      (prismaMock.apiToken.findMany as jest.Mock).mockResolvedValue(tokens);

      const result = await service.findAll(USER_ID);

      expect(result).toHaveLength(2);
      result.forEach((token) => {
        expect(token).not.toHaveProperty('tokenHash');
      });
    });

    it('queries by userId', async () => {
      (prismaMock.apiToken.findMany as jest.Mock).mockResolvedValue([]);

      await service.findAll(USER_ID);

      const callArgs = (prismaMock.apiToken.findMany as jest.Mock).mock
        .calls[0][0] as { where: { userId: string } };
      expect(callArgs.where.userId).toBe(USER_ID);
    });

    it('filters out BOOKMARKLET tokens by kind = USER', async () => {
      (prismaMock.apiToken.findMany as jest.Mock).mockResolvedValue([]);

      await service.findAll(USER_ID);

      const callArgs = (prismaMock.apiToken.findMany as jest.Mock).mock
        .calls[0][0] as { where: { userId: string; kind: string } };
      expect(callArgs.where.kind).toBe('USER');
    });
  });

  describe('revoke', () => {
    it('deletes by both id and userId', async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(
        makeApiToken({ kind: 'USER' }),
      );
      (prismaMock.apiToken.delete as jest.Mock).mockResolvedValue(
        makeApiToken(),
      );

      await service.revoke(USER_ID, TOKEN_ID);

      expect(prismaMock.apiToken.delete).toHaveBeenCalledWith({
        where: { id: TOKEN_ID, userId: USER_ID },
      });
    });

    it('throws NotFoundException when token does not exist', async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.revoke(USER_ID, 'missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when token belongs to another user', async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(
        makeApiToken({ userId: 'someone-else', kind: 'USER' }),
      );

      await expect(service.revoke(USER_ID, TOKEN_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException with the regenerate message when token is a BOOKMARKLET', async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(
        makeApiToken({ kind: 'BOOKMARKLET' }),
      );

      await expect(service.revoke(USER_ID, TOKEN_ID)).rejects.toThrow(
        'Use the Regenerate button to revoke the bookmarklet token',
      );
      expect(prismaMock.apiToken.delete).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when token is an API_DOCS token', async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(
        makeApiToken({ kind: 'API_DOCS' }),
      );

      await expect(service.revoke(USER_ID, TOKEN_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.apiToken.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when delete races and row is gone', async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(
        makeApiToken({ kind: 'USER' }),
      );
      (prismaMock.apiToken.delete as jest.Mock).mockRejectedValue(makeP2025());

      await expect(service.revoke(USER_ID, TOKEN_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('re-throws non-P2025 errors from delete', async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(
        makeApiToken({ kind: 'USER' }),
      );
      (prismaMock.apiToken.delete as jest.Mock).mockRejectedValue(
        new Error('Connection timeout'),
      );

      await expect(service.revoke(USER_ID, TOKEN_ID)).rejects.toThrow(
        'Connection timeout',
      );
    });
  });

  describe('validateToken', () => {
    it('returns user when token matches', async () => {
      const user = { id: USER_ID, email: 'user@example.com' };
      const stored = makeApiToken({ user });
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(stored);
      (prismaMock.apiToken.update as jest.Mock).mockResolvedValue(stored);

      const result = await service.validateToken('ltk_sometoken');

      expect(result).toBe(user);
    });

    it('returns null when token does not match', async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.validateToken('ltk_badtoken');

      expect(result).toBeNull();
    });

    it('updates lastUsedAt on a successful lookup', async () => {
      const stored = makeApiToken({ user: { id: USER_ID } });
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(stored);
      (prismaMock.apiToken.update as jest.Mock).mockResolvedValue(stored);

      await service.validateToken('ltk_sometoken');

      expect(prismaMock.apiToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: expect.any(String) as string },
          data: { lastUsedAt: expect.any(Date) as Date },
        }),
      );
    });
  });
});
