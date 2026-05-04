import { jest } from '@jest/globals';

// avoids the need for a real database
class MockPrismaClientKnownRequestError extends Error {
  code: string;
  constructor(message: string, { code }: { code: string }) {
    super(message);
    this.code = code;
  }
}

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../prisma/generated/client', () => ({
  Prisma: { PrismaClientKnownRequestError: MockPrismaClientKnownRequestError },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LinksService } from './links.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { QUEUES } from '../queue/queue.constants';
import { Prisma } from '../prisma/generated/client';

const INVALID_LINK_URL = 'Hello, world!';
const JOB_ID = 'job-1';
const LINK_ID = 'link-1';
const LINK_URL = 'https://example.com/page';
const MISSING_LINK_ID = 'missing-link';
const USER_ID = 'user-1';

const makeLink = (overrides = {}) => ({
  archivedAt: null,
  createdAt: new Date(),
  id: LINK_ID,
  meta: null,
  updatedAt: new Date(),
  url: LINK_URL,
  userId: USER_ID,
  ...overrides,
});

const makeP2025 = () =>
  new (
    Prisma as {
      PrismaClientKnownRequestError: typeof MockPrismaClientKnownRequestError;
    }
  ).PrismaClientKnownRequestError('Record not found', { code: 'P2025' });

describe('LinksService', () => {
  let service: LinksService;

  const queueMock = {
    send: jest.fn().mockResolvedValue(JOB_ID),
  } as unknown as QueueService;

  const prismaMock = {
    $queryRaw: jest.fn(),
    link: {
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinksService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: QueueService, useValue: queueMock },
      ],
    }).compile();

    service = module.get<LinksService>(LinksService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates link with url and enqueues metadata fetch', async () => {
    (prismaMock.link.findFirst as jest.Mock).mockResolvedValue(null);
    (prismaMock.link.create as jest.Mock).mockResolvedValue(makeLink());

    const link = await service.create(USER_ID, { url: LINK_URL });

    expect(prismaMock.link.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ url: LINK_URL, userId: USER_ID }),
      }),
    );
    expect(link.url).toBe(LINK_URL);
    expect(queueMock.send).toHaveBeenCalledWith(QUEUES.METADATA_FETCH, {
      linkId: LINK_ID,
      url: LINK_URL,
    });
  });

  it('throws on invalid url', async () => {
    await expect(
      service.create(USER_ID, { url: INVALID_LINK_URL }),
    ).rejects.toThrow('Invalid url');
  });

  it('upserts existing link: clears archivedAt, moves to top, re-enqueues metadata when not fetched', async () => {
    const existing = makeLink({ archivedAt: new Date(), meta: null });
    const updated = makeLink({ archivedAt: null });
    (prismaMock.link.findFirst as jest.Mock).mockResolvedValue(existing);
    (prismaMock.link.update as jest.Mock).mockResolvedValue(updated);

    const link = await service.create(USER_ID, { url: LINK_URL });

    expect(prismaMock.link.create).not.toHaveBeenCalled();
    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: LINK_ID },
        data: expect.objectContaining({ archivedAt: null }),
      }),
    );
    expect(queueMock.send).toHaveBeenCalledWith(QUEUES.METADATA_FETCH, {
      linkId: LINK_ID,
      url: LINK_URL,
    });
    expect(link.archivedAt).toBeNull();
  });

  it('upserts existing link without re-enqueuing metadata when already fetched', async () => {
    const existing = makeLink({ meta: { fetchedAt: new Date() } });
    const updated = makeLink();
    (prismaMock.link.findFirst as jest.Mock).mockResolvedValue(existing);
    (prismaMock.link.update as jest.Mock).mockResolvedValue(updated);

    await service.create(USER_ID, { url: LINK_URL });

    expect(queueMock.send).not.toHaveBeenCalled();
  });

  it('findAll returns paginated results with defaults', async () => {
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

  it('findAll filters archived links when archived=true', async () => {
    (prismaMock.link.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.link.count as jest.Mock).mockResolvedValue(0);

    await service.findAll(USER_ID, { archived: true });

    expect(prismaMock.link.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ archivedAt: { not: null } }),
      }),
    );
  });

  it('findAll uses tsvector query when search is provided', async () => {
    (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([
      { id: LINK_ID, total: BigInt(1) },
    ]);
    (prismaMock.link.findMany as jest.Mock).mockResolvedValue([makeLink()]);

    const result = await service.findAll(USER_ID, { search: 'duck' });

    expect(prismaMock.$queryRaw).toHaveBeenCalled();
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
  });

  it('findAll does not use OR filter when search is provided', async () => {
    (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([]);
    (prismaMock.link.findMany as jest.Mock).mockResolvedValue([]);

    await service.findAll(USER_ID, { search: 'duck' });

    const call = (prismaMock.link.findMany as jest.Mock).mock.calls[0]?.[0] as
      | { where?: { OR?: unknown } }
      | undefined;
    expect(call?.where?.OR).toBeUndefined();
  });

  it('findAll returns empty result when tsvector finds no matches', async () => {
    (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([]);

    const result = await service.findAll(USER_ID, { search: 'xyzzy' });

    expect(result.total).toBe(0);
    expect(result.data).toHaveLength(0);
    expect(prismaMock.link.findMany).not.toHaveBeenCalled();
  });

  it('findOne returns link when found', async () => {
    const link = makeLink();
    (prismaMock.link.findFirst as jest.Mock).mockResolvedValue(link);

    const result = await service.findOne(USER_ID, LINK_ID);
    expect(result).toBe(link);
  });

  it('findOne throws NotFoundException when link is not found', async () => {
    (prismaMock.link.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.findOne(USER_ID, MISSING_LINK_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('update returns updated link', async () => {
    const link = makeLink();
    (prismaMock.link.update as jest.Mock).mockResolvedValue(link);

    const result = await service.update(USER_ID, LINK_ID, {});

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: LINK_ID, userId: USER_ID },
      }),
    );
    expect(result).toBe(link);
  });

  it('update throws NotFoundException on P2025', async () => {
    (prismaMock.link.update as jest.Mock).mockRejectedValue(makeP2025());

    await expect(service.update(USER_ID, MISSING_LINK_ID, {})).rejects.toThrow(
      NotFoundException,
    );
  });

  it('archive sets archivedAt and returns link', async () => {
    const archived = makeLink({ archivedAt: new Date() });
    (prismaMock.link.update as jest.Mock).mockResolvedValue(archived);

    const result = await service.archive(USER_ID, LINK_ID);
    expect(result?.archivedAt).not.toBeNull();
  });

  it('archive throws NotFoundException on P2025', async () => {
    (prismaMock.link.update as jest.Mock).mockRejectedValue(makeP2025());

    await expect(service.archive(USER_ID, MISSING_LINK_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('unarchive clears archivedAt and returns link', async () => {
    const unarchived = makeLink({ archivedAt: null });
    (prismaMock.link.update as jest.Mock).mockResolvedValue(unarchived);

    const result = await service.unarchive(USER_ID, LINK_ID);
    expect(result?.archivedAt).toBeNull();
  });

  it('unarchive throws NotFoundException on P2025', async () => {
    (prismaMock.link.update as jest.Mock).mockRejectedValue(makeP2025());

    await expect(service.unarchive(USER_ID, MISSING_LINK_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('removeAllArchived deletes all archived links and returns count', async () => {
    (prismaMock.link.deleteMany as jest.Mock).mockResolvedValue({ count: 3 });

    const result = await service.removeAllArchived(USER_ID);

    expect(prismaMock.link.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, archivedAt: { not: null } },
    });
    expect(result).toEqual({ count: 3 });
  });

  it('remove returns { success: true }', async () => {
    (prismaMock.link.delete as jest.Mock).mockResolvedValue(undefined);

    const result = await service.remove(USER_ID, LINK_ID);

    expect(prismaMock.link.delete).toHaveBeenCalledWith({
      where: { id: LINK_ID, userId: USER_ID },
    });
    expect(result).toEqual({ success: true });
  });

  it('remove throws NotFoundException on P2025', async () => {
    (prismaMock.link.delete as jest.Mock).mockRejectedValue(makeP2025());

    await expect(service.remove(USER_ID, MISSING_LINK_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getRandom returns null when there are no links', async () => {
    (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([]);

    const result = await service.getRandom(USER_ID);

    expect(result).toBeNull();
    expect(prismaMock.link.findFirst).not.toHaveBeenCalled();
  });

  it('getRandom returns a link when links exist', async () => {
    const link = makeLink();
    (prismaMock.$queryRaw as jest.Mock).mockResolvedValue([{ id: LINK_ID }]);
    (prismaMock.link.findFirst as jest.Mock).mockResolvedValue(link);

    const result = await service.getRandom(USER_ID);

    expect(result).toBe(link);
    expect(prismaMock.link.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: LINK_ID } }),
    );
  });
});
