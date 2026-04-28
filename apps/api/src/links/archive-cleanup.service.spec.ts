import { jest } from '@jest/globals';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { ArchiveCleanupService } from './archive-cleanup.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { QUEUES } from '../queue/queue.constants';
import { Test, TestingModule } from '@nestjs/testing';

const WORKER_ID = 'worker-1';

describe('ArchiveCleanupService', () => {
  let service: ArchiveCleanupService;

  const prismaMock = {
    link: {
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
        ArchiveCleanupService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: QueueService, useValue: queueMock },
      ],
    }).compile();

    service = module.get<ArchiveCleanupService>(ArchiveCleanupService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('schedules the archive-cleanup cron on init', async () => {
    await service.onModuleInit();

    expect(queueMock.schedule).toHaveBeenCalledWith(
      QUEUES.ARCHIVE_CLEANUP,
      '0 3 * * *',
    );
  });

  it('registers a worker for the ARCHIVE_CLEANUP queue on init', async () => {
    await service.onModuleInit();

    expect(queueMock.work).toHaveBeenCalledWith(
      QUEUES.ARCHIVE_CLEANUP,
      expect.any(Function),
    );
  });

  it('deletes links archived more than 7 days ago', async () => {
    (prismaMock.link.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });

    await service.deleteExpiredArchivedLinks();

    const call = (prismaMock.link.deleteMany as jest.Mock).mock.calls[0][0] as {
      where: { archivedAt: { lt: Date } };
    };
    const cutoff = call.where.archivedAt.lt;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(cutoff).toBeInstanceOf(Date);
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(
      sevenDaysMs - 1000,
    );
    expect(Date.now() - cutoff.getTime()).toBeLessThanOrEqual(
      sevenDaysMs + 1000,
    );
  });

  it('is a no-op when no expired archived links exist', async () => {
    (prismaMock.link.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

    await expect(service.deleteExpiredArchivedLinks()).resolves.not.toThrow();
    expect(prismaMock.link.deleteMany).toHaveBeenCalledTimes(1);
  });
});
