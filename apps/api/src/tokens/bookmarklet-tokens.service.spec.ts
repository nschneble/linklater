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
import { Prisma } from '../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookmarkletTokensService } from './bookmarklet-tokens.service';
import { TokensService } from './tokens.service';

const makeP2002 = () =>
  new (
    Prisma as {
      PrismaClientKnownRequestError: typeof MockPrismaClientKnownRequestError;
    }
  ).PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
  });

const USER_ID = 'user-1';
const TOKEN_ID = 'bm-1';
const RAW_TOKEN = 'ltk_bookmarkletRawToken1234567890';

const makeApiToken = (overrides = {}) => ({
  id: TOKEN_ID,
  name: 'Bookmarklet',
  prefix: 'ltk_bookmar',
  tokenHash: 'abc123hash',
  userId: USER_ID,
  lastUsedAt: null,
  createdAt: new Date('2026-01-01'),
  secretValue: RAW_TOKEN,
  ...overrides,
});

describe('BookmarkletTokensService', () => {
  let service: BookmarkletTokensService;

  const prismaMock = {
    apiToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const tokensServiceMock = {
    mintRawToken: jest.fn().mockReturnValue({
      rawToken: RAW_TOKEN,
      tokenHash: 'abc123hash',
      prefix: 'ltk_bookmar',
    }),
  } as unknown as TokensService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookmarkletTokensService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: TokensService, useValue: tokensServiceMock },
      ],
    }).compile();

    service = module.get<BookmarkletTokensService>(BookmarkletTokensService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreate', () => {
    it('returns the existing bookmarklet token without creating a new row', async () => {
      const existing = makeApiToken();
      (prismaMock.apiToken.findFirst as jest.Mock).mockResolvedValue(existing);

      const result = await service.getOrCreate(USER_ID);

      expect(prismaMock.apiToken.findFirst).toHaveBeenCalledWith({
        where: { userId: USER_ID, kind: 'BOOKMARKLET' },
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

    it('mints a new bookmarklet token when none exists', async () => {
      (prismaMock.apiToken.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaMock.apiToken.create as jest.Mock).mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve(makeApiToken({ ...data, id: 'bm-new' })),
      );
      (tokensServiceMock.mintRawToken as jest.Mock).mockReturnValue({
        rawToken: RAW_TOKEN,
        tokenHash: 'abc123hash',
        prefix: 'ltk_bookmar',
      });

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
      expect(callArgs.data.name).toBe('Bookmarklet');
      expect(callArgs.data.kind).toBe('BOOKMARKLET');
      expect(callArgs.data.userId).toBe(USER_ID);
      expect(callArgs.data.secretValue).toBe(RAW_TOKEN);
      expect(result.rawToken).toBe(RAW_TOKEN);
    });

    it('falls back to the existing row when create races (P2002)', async () => {
      const raced = makeApiToken({ id: 'bm-raced', secretValue: RAW_TOKEN });
      (prismaMock.apiToken.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(raced);
      (prismaMock.apiToken.create as jest.Mock).mockRejectedValue(makeP2002());

      const result = await service.getOrCreate(USER_ID);

      expect(result.rawToken).toBe(RAW_TOKEN);
      expect(result.id).toBe('bm-raced');
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

    it('throws when secretValue is null (data integrity violation)', async () => {
      const corrupted = makeApiToken({ secretValue: null });
      (prismaMock.apiToken.findFirst as jest.Mock).mockResolvedValue(corrupted);

      await expect(service.getOrCreate(USER_ID)).rejects.toThrow(
        'missing secretValue',
      );
    });
  });

  describe('regenerate', () => {
    it('deletes existing bookmarklet rows and creates a fresh one in a transaction', async () => {
      const created = makeApiToken({ id: 'bm-regen' });

      const transactionMock = prismaMock.$transaction as unknown as jest.Mock;
      transactionMock.mockImplementation(
        async (callback: (transaction: unknown) => Promise<unknown>) => {
          const transactionClient = {
            apiToken: {
              deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
              create: jest
                .fn()
                .mockImplementation(
                  ({ data }: { data: Record<string, unknown> }) =>
                    Promise.resolve({ ...created, ...data }),
                ),
            },
          };
          const result = await callback(transactionClient);
          (
            transactionMock as unknown as {
              lastClient: typeof transactionClient;
            }
          ).lastClient = transactionClient;
          return result;
        },
      );
      (tokensServiceMock.mintRawToken as jest.Mock).mockReturnValue({
        rawToken: RAW_TOKEN,
        tokenHash: 'abc123hash',
        prefix: 'ltk_bookmar',
      });

      const result = await service.regenerate(USER_ID);

      const lastClient = (
        transactionMock as unknown as {
          lastClient: {
            apiToken: { deleteMany: jest.Mock; create: jest.Mock };
          };
        }
      ).lastClient;
      expect(lastClient.apiToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, kind: 'BOOKMARKLET' },
      });
      const createCallArgs = lastClient.apiToken.create.mock.calls[0][0] as {
        data: {
          name: string;
          kind: string;
          secretValue: string;
          userId: string;
        };
      };
      expect(createCallArgs.data.name).toBe('Bookmarklet');
      expect(createCallArgs.data.kind).toBe('BOOKMARKLET');
      expect(createCallArgs.data.userId).toBe(USER_ID);
      expect(createCallArgs.data.secretValue).toBe(RAW_TOKEN);
      expect(result.rawToken).toBe(RAW_TOKEN);
    });
  });
});
