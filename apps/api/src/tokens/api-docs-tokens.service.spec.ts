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

import { ApiDocsTokensService } from './api-docs-tokens.service';
import { Prisma } from '../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { Test, type TestingModule } from '@nestjs/testing';

const makeP2002 = () =>
  new (
    Prisma as {
      PrismaClientKnownRequestError: typeof MockPrismaClientKnownRequestError;
    }
  ).PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
  });

const USER_ID = 'user-1';
const TOKEN_ID = 'docs-1';
const RAW_TOKEN = 'ltk_apiDocsRawToken1234567890abcd';

const makeApiToken = (overrides = {}) => ({
  id: TOKEN_ID,
  name: 'API Docs',
  prefix: 'ltk_apiDocs1',
  tokenHash: 'abc123hash',
  userId: USER_ID,
  lastUsedAt: null,
  createdAt: new Date('2026-01-01'),
  secretValue: RAW_TOKEN,
  ...overrides,
});

describe('ApiDocsTokensService', () => {
  let service: ApiDocsTokensService;

  const prismaMock = {
    apiToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiDocsTokensService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ApiDocsTokensService>(ApiDocsTokensService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreate', () => {
    it('returns the existing API docs token without creating a new row', async () => {
      const existing = makeApiToken();
      (prismaMock.apiToken.findFirst as jest.Mock).mockResolvedValue(existing);

      const result = await service.getOrCreate(USER_ID);

      expect(prismaMock.apiToken.findFirst).toHaveBeenCalledWith({
        where: { userId: USER_ID, kind: 'API_DOCS' },
      });
      expect(prismaMock.apiToken.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: existing.id,
        name: existing.name,
        prefix: existing.prefix,
        createdAt: existing.createdAt,
        lastUsedAt: existing.lastUsedAt,
        rawToken: RAW_TOKEN,
      });
    });

    it('mints a new API docs token when none exists', async () => {
      (prismaMock.apiToken.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaMock.apiToken.create as jest.Mock).mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve(makeApiToken({ ...data, id: 'docs-new' })),
      );

      const result = await service.getOrCreate(USER_ID);

      const callArgs = (prismaMock.apiToken.create as jest.Mock).mock
        .calls[0][0] as {
        data: {
          name: string;
          kind: string;
          secretValue: string;
          userId: string;
        };
      };
      expect(callArgs.data.name).toBe('API Docs');
      expect(callArgs.data.kind).toBe('API_DOCS');
      expect(callArgs.data.userId).toBe(USER_ID);
      // mintRawToken runs for real (pure fn); assert shape not literal
      expect(callArgs.data.secretValue).toMatch(/^ltk_[A-Za-z0-9_-]+$/);
      expect(result.rawToken).toBe(callArgs.data.secretValue);
    });

    it('falls back to the existing row when create races (P2002)', async () => {
      const raced = makeApiToken({ id: 'docs-raced', secretValue: RAW_TOKEN });
      (prismaMock.apiToken.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(raced);
      (prismaMock.apiToken.create as jest.Mock).mockRejectedValue(makeP2002());

      const result = await service.getOrCreate(USER_ID);

      expect(result.rawToken).toBe(RAW_TOKEN);
      expect(result.id).toBe('docs-raced');
    });

    it('re-throws non-P2002 errors from create', async () => {
      (prismaMock.apiToken.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaMock.apiToken.create as jest.Mock).mockRejectedValue(
        new Error('Connection timeout'),
      );

      await expect(service.getOrCreate(USER_ID)).rejects.toThrow(
        'Connection timeout',
      );
    });

    it('re-throws the P2002 error when recovery findFirst also returns null', async () => {
      (prismaMock.apiToken.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (prismaMock.apiToken.create as jest.Mock).mockRejectedValue(makeP2002());

      await expect(service.getOrCreate(USER_ID)).rejects.toMatchObject({
        code: 'P2002',
      });
    });

    it('self-heals by re-minting when the existing row has a null secretValue', async () => {
      const corrupted = makeApiToken({ secretValue: null });
      (prismaMock.apiToken.findFirst as jest.Mock).mockResolvedValue(corrupted);

      const reminted = makeApiToken({
        id: 'docs-healed',
        secretValue: RAW_TOKEN,
      });
      const transactionMock = prismaMock.$transaction as unknown as jest.Mock;
      transactionMock.mockImplementation(
        async (callback: (transaction: unknown) => Promise<unknown>) => {
          const transactionClient = {
            apiToken: {
              deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
              create: jest.fn().mockResolvedValue(reminted),
            },
          };
          return callback(transactionClient);
        },
      );

      const result = await service.getOrCreate(USER_ID);

      expect(result.id).toBe('docs-healed');
      expect(result.rawToken).toBe(RAW_TOKEN);
      // the docs page must never 500 on a row glitch; recovery is silent
      expect(transactionMock).toHaveBeenCalled();
    });
  });
});
