import { jest } from '@jest/globals';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { ReadLinkCleanupService } from './read-link-cleanup.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { QUEUES, RECURRING_JOB_RETRY_OPTIONS } from '../queue/queue.constants';
import { Test, TestingModule } from '@nestjs/testing';

const WORKER_ID = 'worker-1';

describe('ReadLinkCleanupService', () => {
  let service: ReadLinkCleanupService;

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
        ReadLinkCleanupService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: QueueService, useValue: queueMock },
      ],
    }).compile();

    service = module.get<ReadLinkCleanupService>(ReadLinkCleanupService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('schedules the read-link-cleanup cron with a retry policy on init', async () => {
    await service.onModuleInit();

    expect(queueMock.schedule).toHaveBeenCalledWith(
      QUEUES.READ_LINK_CLEANUP,
      '0 3 * * *',
      undefined,
      RECURRING_JOB_RETRY_OPTIONS,
    );
  });

  it('registers a worker for the READ_LINK_CLEANUP queue on init', async () => {
    await service.onModuleInit();

    expect(queueMock.work).toHaveBeenCalledWith(
      QUEUES.READ_LINK_CLEANUP,
      expect.any(Function),
    );
  });

  it('deletes links read more than seven days ago', async () => {
    (prismaMock.link.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });

    await service.deleteExpiredReadLinks();

    const call = (prismaMock.link.deleteMany as jest.Mock).mock.calls[0][0] as {
      where: { readAt: { lt: Date } };
    };
    const cutoff = call.where.readAt.lt;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(cutoff).toBeInstanceOf(Date);
    expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(
      sevenDaysMs - 1000,
    );
    expect(Date.now() - cutoff.getTime()).toBeLessThanOrEqual(
      sevenDaysMs + 1000,
    );
  });

  it('is a no-op when no expired read links exist', async () => {
    (prismaMock.link.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

    await expect(service.deleteExpiredReadLinks()).resolves.not.toThrow();
    expect(prismaMock.link.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('worker callback invokes deleteExpiredReadLinks', async () => {
    let capturedCallback: (() => Promise<void>) | null = null;

    (queueMock.work as jest.Mock).mockImplementation(
      (_queue: string, callback: () => Promise<void>) => {
        capturedCallback = callback;
        return Promise.resolve(WORKER_ID);
      },
    );
    (prismaMock.link.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

    await service.onModuleInit();

    expect(capturedCallback).not.toBeNull();
    await capturedCallback!();

    expect(prismaMock.link.deleteMany).toHaveBeenCalledTimes(1);
  });
});
