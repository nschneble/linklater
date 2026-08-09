import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import * as bcrypt from 'bcryptjs';
import { Prisma, PrismaService } from '../prisma/index.js';
import { withoutPasswordHash } from './users.utils.js';

/**
 * Owns the user record itself: creating it, reading it back, and deleting it.
 * Every method that returns user data calls `withoutPasswordHash` first, apart
 * from `findByEmail` and `findByIdWithPasswordHash`, whose callers need the
 * hash to validate credentials and must not forward the result to a client.
 *
 * Everything that changes what an account can log in with, what its owner has
 * configured, or whether its email is trusted lives in a sibling service:
 * `UserCredentialsService`, `UserSettingsService`, `UserEmailVerificationService`.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new user account. Hashes the password with bcrypt at cost 12
   * before storing it.
   *
   * @param email - The email address for the new account.
   * @param password - The plain-text password (hashed internally).
   * @returns The newly created user without the password hash.
   * @throws {ConflictException} When the email is already registered.
   */
  async create(email: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 12);

    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash },
      });
      return withoutPasswordHash(user);
    } catch (error) {
      // surface the unique-constraint race as a 409, not a leaked P2002 500
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }

  /**
   * Creates a new user without a password (for magic-link sign-ups).
   * Returns `null` when the email is already registered so callers can
   * still send a login magic link to the existing account.
   *
   * @param email - The email address for the new account.
   * @returns The newly created user without the password hash, or `null` if the email is already taken.
   */
  async createWithoutPassword(email: string) {
    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash: null },
      });
      return withoutPasswordHash(user);
    } catch (error) {
      // null return lets magic-link signup fall back to a login link
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Finds a user by email address. Returns the full Prisma User record
   * *including* `passwordHash` – callers that expose user data must call
   * `withoutPasswordHash` themselves (or use `findById` instead).
   *
   * NOTE: This method intentionally returns `null` when no user is found
   * rather than throwing, because `AuthService.validateUser` uses the null
   * signal to avoid user enumeration.
   *
   * @param email - The email address to look up.
   * @returns The full user record (with hash), or `null` if not found.
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Finds a user by UUID and returns the profile without the password hash.
   *
   * @param id - The UUID of the user.
   * @returns The user record without `passwordHash`.
   * @throws {NotFoundException} When no user exists with the given ID.
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return {
      ...withoutPasswordHash(user),
      hasPassword: user.passwordHash !== null,
    };
  }

  /**
   * Finds a user by UUID and returns the full record including the password
   * hash. Used by auth flows that must validate credentials (e.g. password
   * change, reauthentication). Unlike `findById`, this intentionally exposes
   * `passwordHash` – callers must not forward the result to the client.
   *
   * @param id - The UUID of the user.
   * @returns The full user record with `passwordHash` included.
   * @throws {NotFoundException} When no user exists with the given ID.
   */
  async findByIdWithPasswordHash(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return { ...user, hasPassword: user.passwordHash !== null };
  }

  /**
   * Permanently deletes a user account and all associated records (links,
   * metadata) via database cascades.
   *
   * @param id - The UUID of the user to delete.
   */
  async deleteById(id: string) {
    await this.prisma.user.delete({ where: { id } });
  }

  /**
   * Records that the user has dismissed the welcome modal. Uses `updateMany`
   * so a repeated dismissal (button + Escape + backdrop racing on close) is
   * idempotent – only sets `welcomedAt` when it is still `null`.
   */
  async markWelcomed(id: string) {
    await this.prisma.user.updateMany({
      where: { id, welcomedAt: null },
      data: { welcomedAt: new Date() },
    });
  }
}
