import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PGBOSS_INSTANCE } from './queue.constants.js';
import type {
  Job,
  PgBoss,
  ScheduleOptions,
  SendOptions,
  WorkOptions,
} from 'pg-boss';

/**
 * Thin wrapper around the pg-boss job queue. Provides three operations:
 * - `send`: enqueue a one-off job
 * - `work`: register a worker function for a queue
 * - `schedule`: register a recurring cron job
 *
 * All three methods call `createQueue` before the actual operation so that
 * callers do not need to worry about queue initialization order. pg-boss
 * makes `createQueue` idempotent, so repeated calls are safe.
 *
 * The pg-boss instance is started on module init and stopped gracefully on
 * module destroy so that in-progress jobs complete before the process exits.
 *
 * Delivery semantics: pg-boss is at-least-once by default. A worker that
 * crashes after side effects but before pg-boss marks the job complete will
 * see the job redelivered on restart. Every `work` handler in this repo must
 * therefore be idempotent: running the same job twice must produce the same
 * observable state.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  /**
   * Tracks whether pg-boss is currently started and polling. Flipped `true`
   * after a successful `start()` and back to `false` at the start of a graceful
   * shutdown. Read by the `/health` probe as a cheap, in-memory liveness signal
   * for the background-job subsystem (no database round-trip).
   */
  private running = false;

  constructor(@Inject(PGBOSS_INSTANCE) private readonly boss: PgBoss) {}

  /** Starts the pg-boss instance and begins polling for new jobs. */
  async onModuleInit(): Promise<void> {
    await this.boss.start();
    this.running = true;
  }

  /** Stops pg-boss gracefully, waiting for in-flight jobs to complete. */
  async onModuleDestroy(): Promise<void> {
    // flip the flag first so a health probe racing shutdown reports the
    // queue down while in-flight jobs are still draining
    this.running = false;
    await this.boss.stop();
  }

  /**
   * Whether pg-boss has started and not yet been stopped. A cheap, in-memory
   * check (no query) used by the health probe. NOTE: this reflects that
   * `start()` succeeded, not that every worker is actively polling (a truthy
   * value with an exhausted pool is possible). It is a coarse "boss is running"
   * signal, deliberately kept fast and non-flaky.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Enqueues a one-off job. Creates the queue if it does not already exist.
   *
   * @param queue - The name of the queue to send the job to.
   * @param data - The job payload. Must be a plain object.
   * @param options - Optional pg-boss send options (e.g. `retryLimit`,
   *   `retryDelay`, `retryBackoff`) applied to this job. Omit to inherit the
   *   queue's retry policy.
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
   * @param options - Optional pg-boss work options. Pass `localConcurrency` to
   *   run several handlers in parallel (independent local workers) so one slow
   *   job cannot stall the rest of the queue. Omit for a single serial worker.
   * @returns The worker ID assigned by pg-boss.
   */
  async work<T extends object>(
    queue: string,
    handler: (jobs: Job<T>[]) => Promise<void>,
    options?: WorkOptions,
  ): Promise<string> {
    await this.boss.createQueue(queue);
    if (options) {
      return this.boss.work(queue, options, handler);
    }
    return this.boss.work(queue, handler);
  }

  /**
   * Registers a recurring cron job. Creates the queue if it does not already
   * exist. If the schedule already exists it is updated in place.
   *
   * @param name - The name of the queue / schedule.
   * @param cron - A cron expression (e.g. `'0 3 * * *'` for 03:00 UTC daily).
   * @param data - Optional payload to attach to each scheduled job instance.
   * @param options - Optional pg-boss schedule options (e.g. `retryLimit`,
   *   `retryDelay`, `retryBackoff`) applied to every job the schedule enqueues.
   *   Omit for the pg-boss defaults.
   */
  async schedule(
    name: string,
    cron: string,
    data?: object | null,
    options?: ScheduleOptions,
  ): Promise<void> {
    await this.boss.createQueue(name);
    await this.boss.schedule(name, cron, data ?? null, options ?? {});
  }
}
