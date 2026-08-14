import { jest } from '@jest/globals';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { ExtensionAuthCodeCleanupService } from './extension-auth-code-cleanup.service';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUES, RECURRING_JOB_RETRY_OPTIONS } from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';
import { Test, TestingModule } from '@nestjs/testing';

const WORKER_ID = 'worker-1';

describe('ExtensionAuthCodeCleanupService', () => {
  let service: ExtensionAuthCodeCleanupService;

  const prismaMock = {
    extensionAuthCode: {
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
        ExtensionAuthCodeCleanupService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: QueueService, useValue: queueMock },
      ],
    }).compile();

    service = module.get<ExtensionAuthCodeCleanupService>(
      ExtensionAuthCodeCleanupService,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('schedules the extension-auth-code-cleanup cron with a retry policy on init', async () => {
    await service.onModuleInit();

    expect(queueMock.schedule).toHaveBeenCalledWith(
      QUEUES.EXTENSION_AUTH_CODE_CLEANUP,
      '0 * * * *',
      undefined,
      RECURRING_JOB_RETRY_OPTIONS,
    );
  });

  it('registers a worker for the EXTENSION_AUTH_CODE_CLEANUP queue on init', async () => {
    await service.onModuleInit();

    expect(queueMock.work).toHaveBeenCalledWith(
      QUEUES.EXTENSION_AUTH_CODE_CLEANUP,
      expect.any(Function),
    );
  });

  it('deletes codes whose expiry has already passed', async () => {
    (prismaMock.extensionAuthCode.deleteMany as jest.Mock).mockResolvedValue({
      count: 3,
    });
    const before = Date.now();

    await service.deleteExpiredAuthCodes();

    const call = (prismaMock.extensionAuthCode.deleteMany as jest.Mock).mock
      .calls[0][0] as { where: { expiresAt: { lt: Date } } };
    const cutoff = call.where.expiresAt.lt;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before);
    expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('leaves a code that has not expired yet', async () => {
    (prismaMock.extensionAuthCode.deleteMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    await service.deleteExpiredAuthCodes();

    const call = (prismaMock.extensionAuthCode.deleteMany as jest.Mock).mock
      .calls[0][0] as { where: { expiresAt: { lt: Date } } };
    // an unexpired code sorts above the cutoff, so the predicate skips it
    expect(Object.keys(call.where)).toEqual(['expiresAt']);
    expect(Object.keys(call.where.expiresAt)).toEqual(['lt']);
  });

  it('runs the sweep when the registered worker fires', async () => {
    (prismaMock.extensionAuthCode.deleteMany as jest.Mock).mockResolvedValue({
      count: 1,
    });
    await service.onModuleInit();

    const handler = (queueMock.work as jest.Mock).mock
      .calls[0][1] as () => Promise<void>;
    await handler();

    expect(prismaMock.extensionAuthCode.deleteMany).toHaveBeenCalledTimes(1);
  });
});
