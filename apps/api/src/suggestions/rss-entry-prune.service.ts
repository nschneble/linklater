import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../prisma/index.js';
import {
  QueueService,
  QUEUES,
  RECURRING_JOB_RETRY_OPTIONS,
} from '../queue/index.js';

/**
 * Newest entries retained per RSS source. The read path
 * (`RssFeedService.getLatest`) only ever asks for the newest few (the
 * suggestions endpoint caps `count` at 5), so keeping 100 per source leaves
 * generous headroom for any active suggestion cycle while keeping the whole
 * `RssEntry` table tiny (five RSS sources give a ceiling of a few hundred
 * rows). Anything older than the newest 100 is unreachable by the read and
 * safe to drop.
 */
export const MAX_ENTRIES_PER_SOURCE = 100;

/**
 * Scheduled job that bounds the `RssEntry` cache. RSS entries are only ever
 * created and updated on refresh, never deleted inline, so without a sweep
 * the table accumulates every URL every feed has ever emitted. This keeps
 * the newest {@link MAX_ENTRIES_PER_SOURCE} entries per source and deletes
 * the older overflow, mirroring the read-link cleanup sweep. Runs at 04:00
 * UTC daily via a pg-boss cron schedule registered at application startup.
 */
@Injectable()
export class RssEntryPruneService implements OnModuleInit {
  private readonly logger = new Logger(RssEntryPruneService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Schedules the prune cron job and registers its worker on application
   * startup. If the schedule already exists in the pg-boss table it is
   * updated in place. A transient failure retries within minutes (see
   * {@link RECURRING_JOB_RETRY_OPTIONS}) rather than waiting a full day for
   * the next scheduled tick.
   */
  async onModuleInit(): Promise<void> {
    await this.queueService.schedule(
      QUEUES.RSS_ENTRY_PRUNE,
      '0 4 * * *',
      undefined,
      RECURRING_JOB_RETRY_OPTIONS,
    );
    await this.queueService.work(QUEUES.RSS_ENTRY_PRUNE, async () => {
      await this.pruneStaleEntries();
    });
  }

  /**
   * Keeps the newest {@link MAX_ENTRIES_PER_SOURCE} entries per source and
   * deletes the older overflow. Works per source key actually present in the
   * table (via `groupBy`) so entries left behind by a source removed from the
   * registry are still bounded.
   *
   * The overflow read orders newest-first and skips the newest N, so it only
   * ever returns rows the read path cannot reach. Both steps ride existing
   * indexes: the skip-N read uses `(sourceKey, publishedAt DESC)` and the
   * delete targets primary keys.
   *
   * IDEMPOTENT: safe under pg-boss at-least-once delivery. A redelivered job
   * re-evaluates the same overflow predicate, so it either finds the same
   * older rows still present (deletes them) or finds them already gone
   * (no-op). The logged count may understate the work across a retry
   * sequence, but the database state is correct either way.
   */
  async pruneStaleEntries(): Promise<void> {
    const sources = await this.prisma.rssEntry.groupBy({ by: ['sourceKey'] });

    let deletedCount = 0;
    for (const { sourceKey } of sources) {
      const overflow = await this.prisma.rssEntry.findMany({
        where: { sourceKey },
        orderBy: { publishedAt: 'desc' },
        skip: MAX_ENTRIES_PER_SOURCE,
        select: { id: true },
      });

      if (overflow.length === 0) continue;

      const result = await this.prisma.rssEntry.deleteMany({
        where: { id: { in: overflow.map((entry) => entry.id) } },
      });
      deletedCount += result.count;
    }

    this.logger.log(`Pruned ${deletedCount} stale RSS entries`);
  }
}
