import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/index.js';

/**
 * Moves an account's email between its unverified, pending, and verified
 * states. Grouped away from the account record because each write here is a
 * trust decision about who owns the address, not a profile edit.
 */
@Injectable()
export class UserEmailVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Marks the user's email address as verified by setting `emailVerifiedAt`.
   * Called during initial registration verification and when a magic-link
   * user later adds a password via the reset flow.
   *
   * @param id - The UUID of the user.
   */
  async markEmailVerified(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { emailVerifiedAt: new Date() },
    });
  }

  /**
   * Promotes `pendingEmail` to the user's primary email address, marks the
   * email as verified, and clears all pending-email and verification token
   * fields. This is the final step of the email change flow.
   *
   * @param id - The UUID of the user.
   * @param newEmail - The confirmed new email address to apply.
   */
  async confirmPendingEmail(id: string, newEmail: string) {
    await this.prisma.user.update({
      where: { id },
      data: {
        email: newEmail,
        emailVerifiedAt: new Date(),
        pendingEmail: null,
        pendingEmailToken: null,
        pendingEmailTokenExpiresAt: null,
        verificationToken: null,
        verificationTokenExpiresAt: null,
      },
    });
  }

  /**
   * Marks the user's email verified via an externally-controlled channel
   * (OAuth provider assertion, or a magic-link token delivered to the
   * user's inbox) whose row was not necessarily created by the same person.
   * A password set on the row before this moment was never proven to belong
   * to the email's real owner – closing an account-pre-hijacking window – so
   * it is invalidated here, alongside every outstanding session that could
   * have been minted against it: `tokenVersion` is bumped (forces out any
   * live access token – see `JwtStrategy.validate`) and every refresh token
   * / extension auth code for the user is deleted (forces out anything that
   * could otherwise mint a *new* access token from the stale session).
   *
   * All three writes run in one transaction. Splitting the `tokenVersion`
   * bump from the refresh-token deletion into two separate awaits reopens
   * the exact window this method exists to close: a request racing in
   * between would read the just-bumped `tokenVersion` via
   * `RefreshTokenService.refresh` (still-valid refresh token, not yet
   * deleted) and mint a fresh access token carrying the *new* version –
   * one `JwtStrategy.validate` would accept for a full further hour,
   * with which `POST /auth/set-password` could re-establish a credential.
   *
   * Only call this from the FIRST verification of a row (guard on
   * `!emailVerifiedAt` at the call site); calling it on an already-verified
   * account would wipe a legitimately-set password on every subsequent
   * OAuth/magic-link sign-in.
   *
   * @param id - The UUID of the user.
   */
  async verifyEmailAndInvalidateStalePassword(id: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          emailVerifiedAt: new Date(),
          passwordHash: null,
          tokenVersion: { increment: 1 },
        },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId: id } }),
      this.prisma.extensionAuthCode.deleteMany({ where: { userId: id } }),
    ]);
  }
}
