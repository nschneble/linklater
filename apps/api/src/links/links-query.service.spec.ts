import { jest } from '@jest/globals';

// avoids the need for a real database
jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../prisma/generated/client', () => ({
  Prisma: {
    sql: jest.fn(),
    empty: null,
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LinksQueryService } from './links-query.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../prisma/generated/client';

const LINK_ID = 'link-1';
const LINK_URL = 'https://example.com/page';
const MISSING_LINK_ID = 'missing-link';
const USER_ID = 'user-1';

const makeLink = (overrides = {}) => ({
  readAt: null,
  createdAt: new Date(),
  id: LINK_ID,
  meta: null,
  updatedAt: new Date(),
  url: LINK_URL,
  userId: USER_ID,
  ...overrides,
});

describe('LinksQueryService', () => {
  let service: LinksQueryService;

  const prismaMock = {
    $queryRaw: jest.fn(),
    link: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinksQueryService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<LinksQueryService>(LinksQueryService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('returns paginated results with defaults', async () => {
      (prismaMock.link.findMany as jest.Mock).mockResolvedValue([makeLink()]);
      (prismaMock.link.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll(USER_ID, {});

      expect(prismaMock.link.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID },
          skip: 0,
          take: 10,
        }),
      );
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('filters read links when read=true', async () => {
      (prismaMock.link.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.link.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(USER_ID, { read: true });

      expect(prismaMock.link.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ readAt: { not: null } }),
        }),
      );
    });

    it('filters unread links when read=false', async () => {
      (prismaMock.link.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.link.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(USER_ID, { read: false });

      expect(prismaMock.link.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ readAt: null }),
        }),
      );
    });

    it('uses tsvector query when search is provided', async () => {
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([
        { id: LINK_ID, total: BigInt(1) },
      ]);
      (prismaMock.link.findMany as jest.Mock).mockResolvedValue([makeLink()]);

      const result = await service.findAll(USER_ID, { search: 'duck' });

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('does not add OR filter when search is provided', async () => {
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([]);
      (prismaMock.link.findMany as jest.Mock).mockResolvedValue([]);

      await service.findAll(USER_ID, { search: 'duck' });

      const call = (prismaMock.link.findMany as jest.Mock).mock
        .calls[0]?.[0] as { where?: { OR?: unknown } } | undefined;
      expect(call?.where?.OR).toBeUndefined();
    });

    it('wraps the search term in unaccent() so "montréal" matches "montreal"', async () => {
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([]);

      await service.findAll(USER_ID, { search: 'montréal' });

      // $queryRaw is invoked as a tagged template — the first argument is the
      // TemplateStringsArray containing the raw SQL fragments around the
      // interpolated values. We assert that those fragments include the
      // unaccent() wrapper around plainto_tsquery's input (Postel's Law).
      const callArguments = (prismaMock.$queryRaw as jest.Mock).mock
        .calls[0] as [readonly string[], ...unknown[]];
      const sql = callArguments[0].join(' ');
      expect(sql).toContain("plainto_tsquery('english', unaccent(");
    });

    it('returns empty result when tsvector finds no matches', async () => {
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await service.findAll(USER_ID, { search: 'xyzzy' });

      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
      expect(prismaMock.link.findMany).not.toHaveBeenCalled();
    });

    it('treats whitespace-only search as no search term', async () => {
      (prismaMock.link.findMany as jest.Mock).mockResolvedValue([makeLink()]);
      (prismaMock.link.count as jest.Mock).mockResolvedValue(1);

      await service.findAll(USER_ID, { search: '   ' });

      // should use standard findMany, not the raw tsvector query
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
      expect(prismaMock.link.findMany).toHaveBeenCalled();
    });

    it('caps limit at MAX_LIMIT (100)', async () => {
      (prismaMock.link.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.link.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(USER_ID, { limit: 999 });

      expect(prismaMock.link.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('clamps limit to at least 1 when 0 is supplied', async () => {
      (prismaMock.link.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.link.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(USER_ID, { limit: 0 });

      expect(prismaMock.link.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 }),
      );
    });

    it('enforces minimum page of 1', async () => {
      (prismaMock.link.findMany as jest.Mock).mockResolvedValue([]);
      (prismaMock.link.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(USER_ID, { page: -5 });

      expect(prismaMock.link.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }),
      );
    });

    it('uses read filter when search is provided and read=false', async () => {
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([
        { id: LINK_ID, total: BigInt(1) },
      ]);
      (prismaMock.link.findMany as jest.Mock).mockResolvedValue([makeLink()]);

      const result = await service.findAll(USER_ID, {
        search: 'duck',
        read: false,
      });

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(result.total).toBe(1);
    });

    it('uses read=true filter when search is provided', async () => {
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([
        { id: LINK_ID, total: BigInt(1) },
      ]);
      (prismaMock.link.findMany as jest.Mock).mockResolvedValue([
        makeLink({ readAt: new Date() }),
      ]);

      const result = await service.findAll(USER_ID, {
        search: 'duck',
        read: true,
      });

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(result.total).toBe(1);
      expect(result.data[0]).toHaveProperty('readAt');
    });

    it('re-sorts search results to match the raw rank order', async () => {
      const LINK_ID_A = 'link-a';
      const LINK_ID_B = 'link-b';
      // Raw query returns B then A (by rank)
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([
        { id: LINK_ID_B, total: BigInt(2) },
        { id: LINK_ID_A, total: BigInt(2) },
      ]);
      // Prisma returns them in the opposite order
      (prismaMock.link.findMany as jest.Mock).mockResolvedValue([
        makeLink({ id: LINK_ID_A }),
        makeLink({ id: LINK_ID_B }),
      ]);

      const result = await service.findAll(USER_ID, { search: 'test' });

      expect(result.data[0].id).toBe(LINK_ID_B);
      expect(result.data[1].id).toBe(LINK_ID_A);
    });
  });

  describe('findOne', () => {
    it('returns link when found', async () => {
      const link = makeLink();
      (prismaMock.link.findFirst as jest.Mock).mockResolvedValue(link);

      const result = await service.findOne(USER_ID, LINK_ID);
      expect(result).toBe(link);
    });

    it('throws NotFoundException when link is not found', async () => {
      (prismaMock.link.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(USER_ID, MISSING_LINK_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('stumble', () => {
    it('returns null when no unread links exist', async () => {
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await service.stumble(USER_ID);

      expect(result).toBeNull();
    });

    it('atomically marks link as read and returns its url', async () => {
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([
        { id: LINK_ID, url: LINK_URL },
      ]);

      const result = await service.stumble(USER_ID);

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual({ url: LINK_URL });
    });
  });

  describe('getRandom', () => {
    it('returns null when there are no links', async () => {
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await service.getRandom(USER_ID);

      expect(result).toBeNull();
      expect(prismaMock.link.findFirst).not.toHaveBeenCalled();
    });

    it('returns a link when links exist', async () => {
      const link = makeLink();
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([{ id: LINK_ID }]);
      (prismaMock.link.findFirst as jest.Mock).mockResolvedValue(link);

      const result = await service.getRandom(USER_ID);

      expect(result).toBe(link);
      expect(prismaMock.link.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: LINK_ID } }),
      );
    });

    it('queries read links when read=true', async () => {
      (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([]);

      await service.getRandom(USER_ID, true);

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
    });
  });

  // Verify that Prisma is not used for the mocked Prisma module
  it('Prisma import is reachable (mock sanity)', () => {
    expect(Prisma).toBeDefined();
  });
});
