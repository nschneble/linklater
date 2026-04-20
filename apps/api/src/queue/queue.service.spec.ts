import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { PGBOSS_INSTANCE } from './queue.constants';

describe('QueueService', () => {
  let service: QueueService;

  const bossMock = {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue('job-id'),
    work: jest.fn().mockResolvedValue('worker-id'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: PGBOSS_INSTANCE, useValue: bossMock },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('starts pg-boss on init', async () => {
    await service.onModuleInit();
    expect(bossMock.start).toHaveBeenCalledTimes(1);
  });

  it('stops pg-boss on destroy', async () => {
    await service.onModuleDestroy();
    expect(bossMock.stop).toHaveBeenCalledTimes(1);
  });

  it('delegates send to boss.send', async () => {
    bossMock.send.mockResolvedValue('job-id');
    const result = await service.send('my-queue', { foo: 'bar' });
    expect(bossMock.send).toHaveBeenCalledWith('my-queue', { foo: 'bar' });
    expect(result).toBe('job-id');
  });

  it('delegates work to boss.work', async () => {
    const handler = jest.fn();
    await service.work('my-queue', handler as never);
    expect(bossMock.work).toHaveBeenCalledWith('my-queue', handler);
  });
});
