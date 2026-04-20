import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { PgBoss, Job } from 'pg-boss';
import { PGBOSS_INSTANCE } from './queue.constants.js';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(PGBOSS_INSTANCE) private readonly boss: PgBoss) {}

  async onModuleInit(): Promise<void> {
    await this.boss.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.boss.stop();
  }

  async send(queue: string, data: object): Promise<string | null> {
    return this.boss.send(queue, data);
  }

  work<T extends object>(
    queue: string,
    handler: (jobs: Job<T>[]) => Promise<void>,
  ): Promise<string> {
    return this.boss.work(queue, handler);
  }
}
