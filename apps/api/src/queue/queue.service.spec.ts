import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';
import { PGBOSS_INSTANCE } from './queue.constants';
import { QueueService } from './queue.service';

describe('QueueService', () => {
  let service: QueueService;

  const bossMock = {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    createQueue: jest.fn().mockResolvedValue(undefined),
    send: jest.fn().mockResolvedValue('4E550783-D068-45B6-A944-53CDE6098D19'),
    work: jest.fn().mockResolvedValue('87DC4093-BC67-44A9-A113-AD4AEB824ACC'),
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
    bossMock.send.mockResolvedValue('33D5C5ED-1CBB-4268-A776-053D2302EBE4');
    const result = await service.send('maintenance', { marco: 'polo' });
    expect(bossMock.createQueue).toHaveBeenCalledWith('maintenance');
    expect(bossMock.send).toHaveBeenCalledWith('maintenance', {
      marco: 'polo',
    });
    expect(result).toBe('33D5C5ED-1CBB-4268-A776-053D2302EBE4');
  });

  it('delegates work to boss.work', async () => {
    const handler = jest.fn();
    await service.work('maintenance', handler as never);
    expect(bossMock.createQueue).toHaveBeenCalledWith('maintenance');
    expect(bossMock.work).toHaveBeenCalledWith('maintenance', handler);
  });
});
