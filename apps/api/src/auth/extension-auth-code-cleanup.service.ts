import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  QUEUES,
  QueueService,
  RECURRING_JOB_RETRY_OPTIONS,
} from '../queue/index.js';

/**
 * Scheduled sweep of spent and abandoned browser-extension authorization
 * codes. Runs hourly via a pg-boss cron schedule registered at startup.
 *
 * A code is consumed by the exchange that trades it for a token pair, and
 * that path deletes its own row. What accumulates here is the other
 * outcome: a consent the user granted and the extension never came back
 * for, because the window closed, the browser quit, or the callback was
 * lost. Those rows expire five minutes after they are minted and then sit
 * there, holding a user id and a PKCE challenge nothing will ever answer.
 *
 * Hourly rather than by the minute because nothing depends on the row
 * being gone. `exchangeExtensionCode` compares `expiresAt` on every
 * lookup, so an expired row is already refused for the whole time it
 * survives; the sweep is about not keeping the record, not about the
 * verdict.
 */
@Injectable()
export class ExtensionAuthCodeCleanupService implements OnModuleInit {
  private readonly logger = new Logger(ExtensionAuthCodeCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queueService.schedule(
      QUEUES.EXTENSION_AUTH_CODE_CLEANUP,
      '0 * * * *',
      undefined,
      RECURRING_JOB_RETRY_OPTIONS,
    );
    await this.queueService.work(
      QUEUES.EXTENSION_AUTH_CODE_CLEANUP,
      async () => {
        await this.deleteExpiredAuthCodes();
      },
    );
  }

  /**
   * Deletes every authorization code whose expiry has passed, across all
   * users.
   *
   * Idempotent under pg-boss at-least-once delivery, the same way
   * {@link ReadLinkCleanupService.deleteExpiredReadLinks} is: the
   * predicate is re-evaluated per run, so a redelivered job finds the rows
   * still matching or already gone. The cutoff is taken at call time
   * rather than at schedule time, so a job that waited in the queue sweeps
   * against the moment it actually ran.
   */
  async deleteExpiredAuthCodes(): Promise<void> {
    const result = await this.prisma.extensionAuthCode.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    this.logger.log(`Deleted ${result.count} expired extension auth codes`);
  }
}
