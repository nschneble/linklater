import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PGBOSS_INSTANCE } from './queue.constants.js';
import type { PgBoss, Job, SendOptions } from 'pg-boss';

/**
 * Thin wrapper around the pg-boss job queue. Provides three operations:
 * - `send` – enqueue a one-off job
 * - `work` – register a worker function for a queue
 * - `schedule` – register a recurring cron job
 *
 * All three methods call `createQueue` before the actual operation so that
 * callers do not need to worry about queue initialization order. pg-boss
 * makes `createQueue` idempotent, so repeated calls are safe.
 *
 * The pg-boss instance is started on module init and stopped gracefully on
 * module destroy so that in-progress jobs complete before the process exits.
 *
 * DELIVERY SEMANTICS: pg-boss is at-least-once by default. A worker that
 * crashes after side effects but before pg-boss marks the job complete will
 * see the job redelivered on restart. Every handler registered with `work`
 * must therefore be idempotent – running the same job twice must produce
 * the same observable state. The two consumers in this repo
 * (MetadataService.fetchAndStore and ReadLinkCleanupService
 * .deleteExpiredReadLinks) achieve this via Prisma `upsert` and a
 * delete-where-stale predicate respectively; both are safe to retry.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(PGBOSS_INSTANCE) private readonly boss: PgBoss) {}

  /** Starts the pg-boss instance and begins polling for new jobs. */
  async onModuleInit(): Promise<void> {
    await this.boss.start();
  }

  /** Stops pg-boss gracefully, waiting for in-flight jobs to complete. */
  async onModuleDestroy(): Promise<void> {
    await this.boss.stop();
  }

  /**
   * Enqueues a one-off job. Creates the queue if it does not already exist.
   *
   * @param queue - The name of the queue to send the job to.
   * @param data - The job payload. Must be a plain object.
   * @param options - Optional pg-boss send options (e.g. `retryLimit`,
   *   `retryDelay`, `retryBackoff`) applied to this job. Omit for the
   *   pg-boss defaults (no retries).
   * @returns The job ID assigned by pg-boss, or `null` if the job was deduplicated.
   */
  async send(
    queue: string,
    data: object,
    options?: SendOptions,
  ): Promise<string | null> {
    await this.boss.createQueue(queue);
    if (options) {
      return this.boss.send(queue, data, options);
    }
    return this.boss.send(queue, data);
  }

  /**
   * Registers a worker function for a queue. Creates the queue if it does
   * not already exist. The worker receives a batch of jobs; the handler is
   * responsible for processing each one.
   *
   * @param queue - The name of the queue to consume.
   * @param handler - An async function that processes an array of jobs.
   * @returns The worker ID assigned by pg-boss.
   */
  async work<T extends object>(
    queue: string,
    handler: (jobs: Job<T>[]) => Promise<void>,
  ): Promise<string> {
    await this.boss.createQueue(queue);
    return this.boss.work(queue, handler);
  }

  /**
   * Registers a recurring cron job. Creates the queue if it does not already
   * exist. If the schedule already exists it is updated in place.
   *
   * @param name - The name of the queue / schedule.
   * @param cron - A cron expression (e.g. `'0 3 * * *'` for 03:00 UTC daily).
   * @param data - Optional payload to attach to each scheduled job instance.
   */
  async schedule(
    name: string,
    cron: string,
    data?: object | null,
  ): Promise<void> {
    await this.boss.createQueue(name);
    await this.boss.schedule(name, cron, data ?? null, {});
  }
}
