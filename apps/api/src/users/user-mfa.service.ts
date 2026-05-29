import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/index.js';

/**
 * Persistence layer for TOTP / MFA / recovery-code records. All methods read
 * from or write to the `user` (TOTP columns) and `recoveryCode` tables.
 * `UsersService` delegates every MFA call here to keep this responsibility
 * separate from core user CRUD.
 */
@Injectable()
export class UserMfaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes an encrypted TOTP secret to the user row, marking setup as
   * pending (but not yet enabled). Clears `totpEnabledAt` and
   * `totpVerifiedAt` so a re-run of setup after a previous failed attempt
   * starts from a clean state.
   *
   * @param userId - UUID of the user starting setup.
   * @param encryptedSecret - AES-256-GCM ciphertext produced by
   *   `crypto.encrypt`.
   */
  async saveTotpSecret(userId: string, encryptedSecret: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: encryptedSecret,
        totpEnabledAt: null,
        totpVerifiedAt: null,
      },
    });
  }

  /**
   * Clears a pending (not-yet-enabled) TOTP secret. Idempotent: no-op when the
   * user has no pending setup. The `totpEnabledAt: null` filter is intentional
   * — it makes the guard atomic so an enabled account is silently skipped at
   * the DB layer rather than racing a concurrent enable. Callers must still
   * surface a 409 to the user for the enabled case.
   */
  async clearPendingTotpSecret(userId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId, totpEnabledAt: null },
      data: { totpSecret: null, totpVerifiedAt: null },
    });
  }

  /**
   * Writes a fresh MFA challenge nonce for the user. AuthService.login calls
   * this when issuing an MFA challenge JWT; the same nonce is embedded in
   * the JWT and verified at verifyOtp time so a leaked or replayed token
   * carrying a stale nonce is rejected.
   */
  async setMfaNonce(id: string, nonce: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { mfaNonce: nonce },
    });
  }

  /**
   * Clears the MFA nonce after a successful verifyOtp, enforcing single-use
   * semantics on the MFA challenge token. Also doubles as an explicit
   * revocation handle — any code path can call this to invalidate an
   * outstanding MFA token (e.g. after a password change).
   */
  async clearMfaNonce(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { mfaNonce: null },
    });
  }

  /**
   * Atomic compare-and-swap for the TOTP replay guard. Only advances
   * `totpLastUsedStep` when the candidate `step` is strictly greater than
   * the current value (or the current value is `null`). Returns `true`
   * when the swap happened, `false` when a parallel verify-otp request
   * already advanced the step to `>= step`. Callers must treat `false` as
   * a replay attempt and reject the OTP.
   */
  async updateTotpLastUsedStep(id: string, step: number): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: {
        id,
        OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: step } }],
      },
      data: { totpLastUsedStep: step },
    });
    return result.count === 1;
  }

  /**
   * Atomically enables TOTP, records the verified time step (replay prevention),
   * and replaces any existing recovery codes with the provided set.
   */
  async enableTotpWithRecoveryCodes(
    userId: string,
    codeHashes: string[],
    lastUsedStep: number,
  ) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          totpEnabledAt: new Date(),
          totpVerifiedAt: new Date(),
          totpLastUsedStep: lastUsedStep,
        },
      }),
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
      this.prisma.recoveryCode.createMany({
        data: codeHashes.map((codeHash) => ({ userId, codeHash })),
      }),
    ]);
  }

  /**
   * Atomically invalidates all existing recovery codes and stores a fresh set.
   */
  async reissueRecoveryCodes(userId: string, codeHashes: string[]) {
    await this.prisma.$transaction([
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
      this.prisma.recoveryCode.createMany({
        data: codeHashes.map((codeHash) => ({ userId, codeHash })),
      }),
    ]);
  }

  async findUnusedRecoveryCodes(userId: string) {
    return this.prisma.recoveryCode.findMany({
      where: { userId, usedAt: null },
    });
  }

  /**
   * Atomically marks a recovery code as used, but only if it is still unused.
   * Returns `true` when the code was just consumed, `false` when a parallel
   * request had already used it. Callers MUST treat `false` as an auth
   * failure — without this guard, two concurrent verify-otp requests could
   * both succeed on the same code.
   */
  async markRecoveryCodeUsed(id: string): Promise<boolean> {
    const result = await this.prisma.recoveryCode.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return result.count === 1;
  }

  async disableMultiFactor(id: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          totpSecret: null,
          totpEnabledAt: null,
          totpVerifiedAt: null,
          totpLastUsedStep: null,
        },
      }),
      this.prisma.recoveryCode.deleteMany({ where: { userId: id } }),
    ]);
  }
}
