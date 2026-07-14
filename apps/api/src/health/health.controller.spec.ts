import { jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';

import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: { check: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    healthService = { check: jest.fn() };
    controller = new HealthController(
      healthService as unknown as HealthService,
    );
  });

  it('delegates to the service and returns its ok status', async () => {
    healthService.check.mockResolvedValue({ status: 'ok', database: 'up' });

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
    expect(healthService.check).toHaveBeenCalledTimes(1);
  });

  it('propagates the 503 the service throws when the database is down', async () => {
    healthService.check.mockRejectedValue(new ServiceUnavailableException());

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
