import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/index.js';
import { QueueService, QUEUES } from '../queue/index.js';

/** Seven days expressed in milliseconds — the retention period for archived links. */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Scheduled job that automatically deletes archived links older than seven days.
 * Runs at 03:00 UTC every day via a pg-boss cron schedule registered at
 * application startup.
 *
 * NOTE: The seven-day window is intentional — it gives users a grace period to
 * unarchive a link they marked as read accidentally, without accumulating
 * stale data indefinitely.
 */
@Injectable()
export class ArchiveCleanupService implements OnModuleInit {
  private readonly logger = new Logger(ArchiveCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Schedules the cleanup cron job and registers its worker on application startup.
   * If the schedule already exists in the pg-boss table it is updated in place.
   */
  async onModuleInit(): Promise<void> {
    await this.queueService.schedule(QUEUES.ARCHIVE_CLEANUP, '0 3 * * *');
    await this.queueService.work(QUEUES.ARCHIVE_CLEANUP, async () => {
      await this.deleteExpiredArchivedLinks();
    });
  }

  /**
   * Deletes all archived links whose `readAt` timestamp is older than
   * seven days. Scoped across all users — this is a global cleanup, not
   * per-user.
   *
   * @returns Resolves when the delete completes. The count of deleted rows is logged.
   */
  async deleteExpiredArchivedLinks(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);
    const result = await this.prisma.link.deleteMany({
      where: { readAt: { lt: sevenDaysAgo } },
    });
    this.logger.log(`Deleted ${result.count} expired archived links`);
  }
}
