import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/index.js';
import { QueueService, QUEUES } from '../queue/index.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ArchiveCleanupService implements OnModuleInit {
  private readonly logger = new Logger(ArchiveCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queueService.schedule(QUEUES.ARCHIVE_CLEANUP, '0 3 * * *');
    await this.queueService.work(QUEUES.ARCHIVE_CLEANUP, async () => {
      await this.deleteExpiredArchivedLinks();
    });
  }

  async deleteExpiredArchivedLinks(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);
    const result = await this.prisma.link.deleteMany({
      where: { archivedAt: { lt: sevenDaysAgo } },
    });
    this.logger.log(`Deleted ${result.count} expired archived links`);
  }
}
