import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/index.js';
import {
  QueueService,
  QUEUES,
  RECURRING_JOB_RETRY_OPTIONS,
} from '../queue/index.js';

/** Seven days in ms: the retention period for read links. */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Scheduled job that automatically deletes read links older than seven days.
 * Runs at 03:00 UTC every day via a pg-boss cron schedule registered at
 * application startup.
 *
 * NOTE: The seven-day window is intentional. It gives users a grace period
 * to unread a link they marked as read accidentally, without accumulating
 * stale data indefinitely.
 */
@Injectable()
export class ReadLinkCleanupService implements OnModuleInit {
  private readonly logger = new Logger(ReadLinkCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Schedules the cleanup cron job and registers its worker on application startup.
   * If the schedule already exists in the pg-boss table it is updated in place.
   * A transient failure retries within minutes (see
   * {@link RECURRING_JOB_RETRY_OPTIONS}) rather than waiting a full day for the
   * next scheduled tick.
   */
  async onModuleInit(): Promise<void> {
    await this.queueService.schedule(
      QUEUES.READ_LINK_CLEANUP,
      '0 3 * * *',
      undefined,
      RECURRING_JOB_RETRY_OPTIONS,
    );
    await this.queueService.work(QUEUES.READ_LINK_CLEANUP, async () => {
      await this.deleteExpiredReadLinks();
    });
  }

  /**
   * Deletes all read links whose `readAt` timestamp is older than
   * seven days. Scoped across all users - this is a global cleanup, not
   * per-user.
   *
   * IDEMPOTENT: safe under pg-boss at-least-once delivery. The
   * `where: { readAt: { lt: sevenDaysAgo } }` predicate is re-evaluated
   * on every run, so a redelivered job either finds the same rows still
   * matching (deletes them) or finds them already gone (no-op). The
   * logged row count may understate the work done across the retry
   * sequence, but the database state is correct in either case.
   *
   * @returns Resolves when the delete completes. The count of deleted rows is logged.
   */
  async deleteExpiredReadLinks(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);
    const result = await this.prisma.link.deleteMany({
      where: { readAt: { lt: sevenDaysAgo } },
    });
    this.logger.log(`Deleted ${result.count} expired read links`);
  }
}
