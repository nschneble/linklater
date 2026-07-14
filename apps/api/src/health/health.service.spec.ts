import { jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';

import { HealthService } from './health.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = { $queryRaw: jest.fn() };
    service = new HealthService(prisma as unknown as PrismaService);
  });

  it('reports ok when the database answers the probe', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
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
