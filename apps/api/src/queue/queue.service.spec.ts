import { jest } from '@jest/globals';

import { PGBOSS_INSTANCE } from './queue.constants';
import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';

const JOB_ID = 'job-1';
const QUEUE_NAME = 'my-queue';
const WORKER_ID = 'worker-1';

describe('QueueService', () => {
  let service: QueueService;

  const bossMock = {
    createQueue: jest.fn().mockResolvedValue(undefined),
    schedule: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue(JOB_ID),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    work: jest.fn().mockResolvedValue(WORKER_ID),
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
    bossMock.send.mockResolvedValue(JOB_ID);

    const result = await service.send(QUEUE_NAME, { q: 'duck' });

    expect(bossMock.createQueue).toHaveBeenCalledWith(QUEUE_NAME);
    expect(bossMock.send).toHaveBeenCalledWith(QUEUE_NAME, { q: 'duck' });
    expect(result).toBe(JOB_ID);
  });

  it('delegates work to boss.work', async () => {
    const handler = jest.fn();

    await service.work(QUEUE_NAME, handler as never);

    expect(bossMock.createQueue).toHaveBeenCalledWith(QUEUE_NAME);
    expect(bossMock.work).toHaveBeenCalledWith(QUEUE_NAME, handler);
  });

  it('delegates schedule to boss.schedule', async () => {
    await service.schedule(QUEUE_NAME, '0 3 * * *');

    expect(bossMock.createQueue).toHaveBeenCalledWith(QUEUE_NAME);
    expect(bossMock.schedule).toHaveBeenCalledWith(
      QUEUE_NAME,
      '0 3 * * *',
      null,
      {},
    );
  });

  it('passes data to boss.schedule when provided', async () => {
    await service.schedule(QUEUE_NAME, '0 3 * * *', { key: 'value' });

    expect(bossMock.createQueue).toHaveBeenCalledWith(QUEUE_NAME);
    expect(bossMock.schedule).toHaveBeenCalledWith(
      QUEUE_NAME,
      '0 3 * * *',
      { key: 'value' },
      {},
    );
  });

  it('propagates errors thrown by boss.send', async () => {
    bossMock.send.mockRejectedValue(new Error('pg-boss connection lost'));

    await expect(service.send(QUEUE_NAME, { q: 'duck' })).rejects.toThrow(
      'pg-boss connection lost',
    );
  });

  it('propagates errors thrown by boss.work', async () => {
    const handler = jest.fn();
    bossMock.work.mockRejectedValue(new Error('worker registration failed'));

    await expect(service.work(QUEUE_NAME, handler as never)).rejects.toThrow(
      'worker registration failed',
    );
  });
});
