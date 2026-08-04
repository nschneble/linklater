import type { Prisma } from '../prisma/index.js';

/**
 * Recipient filter for the policy-update notice. Only accounts that proved
 * ownership of their address (verified) are included: an unverified address
 * was never shown to belong to the person who typed it, so notifying it
 * could disclose account activity to a stranger.
 */
export const verifiedRecipientWhere: Prisma.UserWhereInput = {
  emailVerifiedAt: { not: null },
};

export function parseArguments(argv: string[]): {
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
