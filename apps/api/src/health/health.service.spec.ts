import { jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';

import { HealthService } from './health.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueueService } from '../queue/queue.service.js';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: { $queryRaw: jest.Mock };
  let queue: { isRunning: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = { $queryRaw: jest.fn() };
    queue = { isRunning: jest.fn().mockReturnValue(true) };
    service = new HealthService(
      prisma as unknown as PrismaService,
      queue as unknown as QueueService,
    );
  });

  it('reports ok with the queue up when both the database and queue answer', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    queue.isRunning.mockReturnValue(true);

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
      queue: 'up',
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('reports the queue as down without failing the probe when pg-boss is stopped', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    queue.isRunning.mockReturnValue(false);

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
      queue: 'down',
    });
  });

  it('throws 503 with a down status when the probe fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    try {
      await service.check();
    } catch (error) {
      expect((error as ServiceUnavailableException).getResponse()).toEqual({
        status: 'error',
        database: 'down',
      });
    }
  });
});
