import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { EmailQueueService } from '../email/index.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * One-shot operator script: enqueues the privacy-policy change notice for
 * every verified account (docs/PRIVACY.md promises email notice before
 * material changes take effect). Unverified accounts are skipped — their
 * address was never proven to belong to the person who typed it.
 *
 * Delivery rides the normal `email-send` pg-boss queue, so the worker in the
 * running API process performs the sends with the usual retry policy, and
 * this script exits as soon as everything is enqueued.
 *
 * Usage (on the VPS, against the running stack):
 *
 *   docker compose -f docker-compose.prod.yml run --rm api \
 *     node dist/scripts/announce-policy-update.js --effective-date "August 15, 2026"
 *
 * Add --dry-run to print the recipient count without enqueuing anything.
 *
 * The script boots the full AppModule as a Nest application context, so its
 * short-lived container also registers queue workers alongside the running
 * API's. That overlap is harmless: pg-boss hands each job to exactly one
 * worker, both processes share the same SMTP configuration, and the
 * recurring-job schedules it re-registers are idempotent.
 */
function parseArguments(argv: string[]): {
  effectiveDate: string;
  dryRun: boolean;
} {
  const dryRun = argv.includes('--dry-run');
  const flagIndex = argv.indexOf('--effective-date');
  const effectiveDate = flagIndex === -1 ? undefined : argv[flagIndex + 1];

  if (!effectiveDate) {
    console.error(
      'Usage: announce-policy-update --effective-date "<human-readable date>" [--dry-run]',
    );
    process.exit(1);
  }

  return { effectiveDate, dryRun };
}

async function main(): Promise<void> {
  const { effectiveDate, dryRun } = parseArguments(process.argv.slice(2));

  const applicationContext = await NestFactory.createApplicationContext(
    AppModule,
    { logger: ['error', 'warn'] },
  );

  try {
    const prisma = applicationContext.get(PrismaService);
    const emailQueue = applicationContext.get(EmailQueueService);

    const recipients = await prisma.user.findMany({
      where: { emailVerifiedAt: { not: null } },
      select: { email: true, theme: true },
      orderBy: { createdAt: 'asc' },
    });

    if (dryRun) {
      console.log(
        `[dry run] Would enqueue the policy-update notice (effective ${effectiveDate}) for ${recipients.length} verified account(s).`,
      );
      return;
    }

    for (const recipient of recipients) {
      await emailQueue.enqueuePolicyUpdate(
        recipient.email,
        effectiveDate,
        recipient.theme,
      );
    }

    console.log(
      `Enqueued the policy-update notice (effective ${effectiveDate}) for ${recipients.length} verified account(s).`,
    );
  } finally {
    await applicationContext.close();
  }
}

await main();
