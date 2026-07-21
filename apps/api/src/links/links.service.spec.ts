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

import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LinksService } from './links.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { QUEUES } from '../queue/queue.constants';
import { METADATA_SEND_OPTIONS } from '../metadata/metadata.constants';
import { Prisma } from '../prisma/generated/client';

const JOB_ID = 'job-1';
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

  // ──────────────────────────────────────────────
  // create
  // ──────────────────────────────────────────────

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
    expect(link.status).toBe('created');
    expect(queueMock.send).toHaveBeenCalledWith(
      QUEUES.METADATA_FETCH,
      { linkId: LINK_ID, url: LINK_URL },
      METADATA_SEND_OPTIONS,
    );
  });

  it('upserts existing link: clears readAt, moves to top, re-enqueues metadata when not fetched', async () => {
    const existing = makeLink({ readAt: new Date(), meta: null });
    const updated = makeLink({ readAt: null });
    (prismaMock.link.findFirst as jest.Mock).mockResolvedValue(existing);
    (prismaMock.link.update as jest.Mock).mockResolvedValue(updated);

    const link = await service.create(USER_ID, { url: LINK_URL });

    expect(prismaMock.link.create).not.toHaveBeenCalled();
    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: LINK_ID },
        data: expect.objectContaining({ readAt: null }),
      }),
    );
    expect(queueMock.send).toHaveBeenCalledWith(
      QUEUES.METADATA_FETCH,
      { linkId: LINK_ID, url: LINK_URL },
      METADATA_SEND_OPTIONS,
    );
    expect(link.readAt).toBeNull();
    expect(link.status).toBe('resurfaced');
  });

  it('upserts existing link without re-enqueuing metadata when already fetched', async () => {
    const existing = makeLink({ meta: { fetchedAt: new Date() } });
    const updated = makeLink();
    (prismaMock.link.findFirst as jest.Mock).mockResolvedValue(existing);
    (prismaMock.link.update as jest.Mock).mockResolvedValue(updated);

    await service.create(USER_ID, { url: LINK_URL });

    expect(queueMock.send).not.toHaveBeenCalled();
  });

  it('recovers from a concurrent-create P2002 by resurfacing the row that won the race', async () => {
    // Both POST /links calls hit findFirst at the same moment and saw no
    // existing row. The first to reach .create wins; the second hits the
    // unique constraint, then re-queries and finds the now-existing row.
    const racedExisting = makeLink({ readAt: new Date(), meta: null });
    const resurfaced = makeLink({ readAt: null });
    (prismaMock.link.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(racedExisting);
    (prismaMock.link.create as jest.Mock).mockRejectedValue(
      new (
        Prisma as {
          PrismaClientKnownRequestError: typeof MockPrismaClientKnownRequestError;
        }
      ).PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
      }),
    );
    (prismaMock.link.update as jest.Mock).mockResolvedValue(resurfaced);

    const link = await service.create(USER_ID, { url: LINK_URL });

    expect(prismaMock.link.create).toHaveBeenCalled();
    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: LINK_ID },
        data: expect.objectContaining({ readAt: null }),
      }),
    );
    expect(link.readAt).toBeNull();
    expect(link.status).toBe('resurfaced');
  });

  it('re-throws the original P2002 when findFirst returns null after the race (row vanished between constraint error and recovery query)', async () => {
    // The race winner created the row but immediately deleted it. The recovery
    // findFirst finds nothing, so the service has no row to resurface – it
    // must propagate the original P2002 rather than swallow it silently.
    const p2002 = new (
      Prisma as {
        PrismaClientKnownRequestError: typeof MockPrismaClientKnownRequestError;
      }
    ).PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
    });
    (prismaMock.link.findFirst as jest.Mock)
      .mockResolvedValueOnce(null) // initial existence check
      .mockResolvedValueOnce(null); // recovery query after P2002
    (prismaMock.link.create as jest.Mock).mockRejectedValue(p2002);

    await expect(service.create(USER_ID, { url: LINK_URL })).rejects.toThrow(
      'Unique constraint failed',
    );
  });

  // ──────────────────────────────────────────────
  // read
  // ──────────────────────────────────────────────

  it('read sets readAt and returns link', async () => {
    const read = makeLink({ readAt: new Date() });
    (prismaMock.link.update as jest.Mock).mockResolvedValue(read);

    const result = await service.read(USER_ID, LINK_ID);
    expect(result?.readAt).not.toBeNull();
  });

  it('read throws NotFoundException on P2025', async () => {
    (prismaMock.link.update as jest.Mock).mockRejectedValue(makeP2025());

    await expect(service.read(USER_ID, MISSING_LINK_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('read rethrows non-P2025 errors', async () => {
    const networkError = new Error('Network failure');
    (prismaMock.link.update as jest.Mock).mockRejectedValue(networkError);

    await expect(service.read(USER_ID, LINK_ID)).rejects.toThrow(
      'Network failure',
    );
  });

  // ──────────────────────────────────────────────
  // unread
  // ──────────────────────────────────────────────

  it('unread clears readAt and returns link', async () => {
    const unread = makeLink({ readAt: null });
    (prismaMock.link.update as jest.Mock).mockResolvedValue(unread);

    const result = await service.unread(USER_ID, LINK_ID);
    expect(result?.readAt).toBeNull();
  });

  it('unread throws NotFoundException on P2025', async () => {
    (prismaMock.link.update as jest.Mock).mockRejectedValue(makeP2025());

    await expect(service.unread(USER_ID, MISSING_LINK_ID)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('unread rethrows non-P2025 errors', async () => {
    const networkError = new Error('Network failure');
    (prismaMock.link.update as jest.Mock).mockRejectedValue(networkError);

    await expect(service.unread(USER_ID, LINK_ID)).rejects.toThrow(
      'Network failure',
    );
  });

  // ──────────────────────────────────────────────
  // remove
  // ──────────────────────────────────────────────

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

  it('remove rethrows non-P2025 errors', async () => {
    const networkError = new Error('Network failure');
    (prismaMock.link.delete as jest.Mock).mockRejectedValue(networkError);

    await expect(service.remove(USER_ID, LINK_ID)).rejects.toThrow(
      'Network failure',
    );
  });

  // ──────────────────────────────────────────────
  // removeAllRead
  // ──────────────────────────────────────────────

  it('removeAllRead deletes all read links and returns count', async () => {
    (prismaMock.link.deleteMany as jest.Mock).mockResolvedValue({ count: 3 });

    const result = await service.removeAllRead(USER_ID);

    expect(prismaMock.link.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, readAt: { not: null } },
    });
    expect(result).toEqual({ count: 3 });
  });
});
