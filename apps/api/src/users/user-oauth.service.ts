import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/index.js';
import { withoutPasswordHash } from './users.utils.js';

/**
 * Persistence layer for OAuth-account records. All methods read from or write
 * to the `oAuthAccount` table. `UsersService` delegates every OAuth call here
 * so that this responsibility is isolated from core user CRUD.
 */
@Injectable()
export class UserOAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async createOAuthUser(email: string) {
    const user = await this.prisma.user.create({
      data: { email, passwordHash: null, emailVerifiedAt: new Date() },
    });
    return withoutPasswordHash(user);
  }

  async createOAuthUserAndLink(
    email: string,
    provider: string,
    providerId: string,
    providerEmail: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { email, passwordHash: null, emailVerifiedAt: new Date() },
      });
      await transaction.oAuthAccount.create({
        data: { userId: user.id, provider, providerId, providerEmail },
      });
      return withoutPasswordHash(user);
    });
  }

  async findOAuthAccount(provider: string, providerId: string) {
    return this.prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider, providerId } },
      include: { user: true },
    });
  }

  async linkOAuthAccount(
    userId: string,
    provider: string,
    providerId: string,
    providerEmail: string,
  ) {
    await this.prisma.oAuthAccount.create({
      data: { userId, provider, providerId, providerEmail },
    });
  }

  /**
   * Refreshes the stored `providerEmail` for an already-linked account.
   * Uses `updateMany` so a concurrent unlink is a clean no-op instead of a
   * P2025. Identity is keyed by `(provider, providerId)`; this column is
   * purely informational, so silently skipping a vanished row is correct.
   */
  async updateOAuthProviderEmail(
    userId: string,
    provider: string,
    providerId: string,
    providerEmail: string,
  ): Promise<void> {
    await this.prisma.oAuthAccount.updateMany({
      where: { userId, provider, providerId },
      data: { providerEmail },
    });
  }

  async listOAuthAccounts(userId: string): Promise<
    {
      provider: string;
      providerEmail: string;
      connectedAt: Date;
    }[]
  > {
    const accounts = await this.prisma.oAuthAccount.findMany({
      where: { userId },
      select: { provider: true, providerEmail: true, createdAt: true },
    });
    return accounts.map((account) => ({
      provider: account.provider,
      providerEmail: account.providerEmail,
      connectedAt: account.createdAt,
    }));
  }

  async unlinkOAuthAccount(userId: string, provider: string): Promise<void> {
    await this.prisma.oAuthAccount.deleteMany({ where: { userId, provider } });
  }
}
