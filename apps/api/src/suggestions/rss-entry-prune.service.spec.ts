import { jest } from '@jest/globals';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { Test, type TestingModule } from '@nestjs/testing';

import { MAX_ENTRIES_PER_SOURCE } from './rss-entry-prune.service';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUES, RECURRING_JOB_RETRY_OPTIONS } from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';
import { RssEntryPruneService } from './rss-entry-prune.service';

const WORKER_ID = 'worker-1';

describe('RssEntryPruneService', () => {
  let service: RssEntryPruneService;

  const prismaMock = {
    rssEntry: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const queueMock = {
    schedule: jest.fn().mockResolvedValue(undefined),
    work: jest.fn().mockResolvedValue(WORKER_ID),
  } as unknown as QueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RssEntryPruneService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: QueueService, useValue: queueMock },
      ],
    }).compile();

    service = module.get<RssEntryPruneService>(RssEntryPruneService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('schedules the rss-entry-prune cron with a retry policy on init', async () => {
    await service.onModuleInit();

    expect(queueMock.schedule).toHaveBeenCalledWith(
      QUEUES.RSS_ENTRY_PRUNE,
      '0 4 * * *',
      undefined,
      RECURRING_JOB_RETRY_OPTIONS,
    );
  });

  it('registers a worker for the RSS_ENTRY_PRUNE queue on init', async () => {
    await service.onModuleInit();

    expect(queueMock.work).toHaveBeenCalledWith(
      QUEUES.RSS_ENTRY_PRUNE,
      expect.any(Function),
    );
  });

  it('deletes entries beyond the per-source cap and keeps the newest N', async () => {
    (prismaMock.rssEntry.groupBy as jest.Mock).mockResolvedValue([
      { sourceKey: 'aeon' },
    ]);
    // The read of stale rows skips the newest N (ordered newest-first) so it
    // only ever returns the older overflow. These three are the overflow.
    (prismaMock.rssEntry.findMany as jest.Mock).mockResolvedValue([
      { id: 'old-1' },
      { id: 'old-2' },
      { id: 'old-3' },
    ]);
    (prismaMock.rssEntry.deleteMany as jest.Mock).mockResolvedValue({
      count: 3,
    });

    await service.pruneStaleEntries();

    const findCall = (prismaMock.rssEntry.findMany as jest.Mock).mock
      .calls[0][0] as {
      where: { sourceKey: string };
      orderBy: { publishedAt: 'desc' };
      skip: number;
      select: { id: boolean };
    };
    // Ordering newest-first + skipping the newest N is what preserves the
    // rows an active suggestion cycle reads; only older overflow is selected.
    expect(findCall.where.sourceKey).toBe('aeon');
    expect(findCall.orderBy.publishedAt).toBe('desc');
    expect(findCall.skip).toBe(MAX_ENTRIES_PER_SOURCE);
    expect(findCall.select.id).toBe(true);

    const deleteCall = (prismaMock.rssEntry.deleteMany as jest.Mock).mock
      .calls[0][0] as { where: { id: { in: string[] } } };
    expect(deleteCall.where.id.in).toEqual(['old-1', 'old-2', 'old-3']);
  });

  it('prunes each source independently', async () => {
    (prismaMock.rssEntry.groupBy as jest.Mock).mockResolvedValue([
      { sourceKey: 'aeon' },
      { sourceKey: 'nautilus' },
    ]);
    (prismaMock.rssEntry.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: 'aeon-old' }])
      .mockResolvedValueOnce([{ id: 'nautilus-old' }]);
    (prismaMock.rssEntry.deleteMany as jest.Mock).mockResolvedValue({
      count: 1,
    });

    await service.pruneStaleEntries();

    expect(prismaMock.rssEntry.findMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.rssEntry.deleteMany).toHaveBeenCalledTimes(2);
  });

  it('is a no-op for a source that is under the cap', async () => {
    (prismaMock.rssEntry.groupBy as jest.Mock).mockResolvedValue([
      { sourceKey: 'aeon' },
    ]);
    (prismaMock.rssEntry.findMany as jest.Mock).mockResolvedValue([]);

    await service.pruneStaleEntries();

    expect(prismaMock.rssEntry.deleteMany).not.toHaveBeenCalled();
  });

  it('is a no-op when the table is empty', async () => {
    (prismaMock.rssEntry.groupBy as jest.Mock).mockResolvedValue([]);

    await expect(service.pruneStaleEntries()).resolves.not.toThrow();
    expect(prismaMock.rssEntry.findMany).not.toHaveBeenCalled();
    expect(prismaMock.rssEntry.deleteMany).not.toHaveBeenCalled();
  });

  it('worker callback invokes pruneStaleEntries', async () => {
    let capturedCallback: (() => Promise<void>) | null = null;

    (queueMock.work as jest.Mock).mockImplementation(
      (_queue: string, callback: () => Promise<void>) => {
        capturedCallback = callback;
        return Promise.resolve(WORKER_ID);
      },
    );
    (prismaMock.rssEntry.groupBy as jest.Mock).mockResolvedValue([]);

    await service.onModuleInit();

    expect(capturedCallback).not.toBeNull();
    await capturedCallback!();

    expect(prismaMock.rssEntry.groupBy).toHaveBeenCalledTimes(1);
  });
});
