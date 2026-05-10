import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { EmailService } from '../email/index.js';
import { Prisma } from '../prisma/index.js';
import { UsersService, withoutPasswordHash } from '../users/index.js';

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;

/** Returns a cryptographically random 64-character hex string for use as a one-time token. */
function generateToken() {
  return randomBytes(32).toString('hex');
}

/**
 * Returns a `Date` that is `ms` milliseconds in the future.
 * Used to compute token expiry timestamps consistently.
 */
function expiresInMs(ms: number) {
  return new Date(Date.now() + ms);
}

/**
 * Handles all authentication flows: credential validation, JWT issuance,
 * email verification, password reset, and email change confirmation.
 *
 * Tokens (verification, reset, pending-email) are 32-byte random hex strings
 * stored directly on the User record. Each token type has its own expiry
 * column so the expiry check is always co-located with the lookup.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Creates a new user account and sends an email verification message.
   *
   * @param email - The email address to register.
   * @param password - The plain-text password (hashed by UsersService).
   * @returns The newly created user without the password hash.
   * @throws {ConflictException} When the email is already taken.
   */
  async register(email: string, password: string) {
    const user = await this.usersService.create(email, password);
    await this.sendVerificationEmail(user.id);
    return user;
  }

  /**
   * Returns the current authenticated user's profile, remapping `id` to
   * `userId` so the response shape is consistent with the JWT payload.
   *
   * @param userId - The UUID from the JWT.
   * @returns The user record without `passwordHash`, with `userId` instead of `id`.
   * @throws {NotFoundException} When no user exists with the given ID.
   */
  async me(userId: string) {
    const { id, ...rest } = await this.usersService.findById(userId);
    return { userId: id, ...rest };
  }

  /**
   * Checks whether the given email/password pair matches a stored account.
   * Returns the user without the password hash on success, or `null` if
   * the account does not exist or the password is wrong.
   *
   * NOTE: Returning `null` for both "no account" and "wrong password" is
   * intentional — it prevents user enumeration via different error messages.
   *
   * @param email - The email address to look up.
   * @param password - The plain-text password to compare against the bcrypt hash.
   * @returns The user record without `passwordHash`, or `null` on failure.
   */
  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.passwordHash) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;

    return withoutPasswordHash(user);
  }

  async findOrCreateOAuthUser(
    provider: string,
    providerId: string,
    email: string,
  ): Promise<{ userId: string; email: string }> {
    const account = await this.usersService.findOAuthAccount(
      provider,
      providerId,
    );
    if (account) {
      return { userId: account.userId, email: account.user.email };
    }

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      await this.usersService.linkOAuthAccount(
        existingUser.id,
        provider,
        providerId,
      );
      if (!existingUser.emailVerifiedAt) {
        await this.usersService.markEmailVerified(existingUser.id);
      }
      return { userId: existingUser.id, email: existingUser.email };
    }

    try {
      const newUser = await this.usersService.createOAuthUser(email);
      await this.usersService.linkOAuthAccount(
        newUser.id,
        provider,
        providerId,
      );
      return { userId: newUser.id, email };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raceAccount = await this.usersService.findOAuthAccount(
          provider,
          providerId,
        );
        if (raceAccount) {
          return { userId: raceAccount.userId, email: raceAccount.user.email };
        }
        const raceUser = await this.usersService.findByEmail(email);
        if (raceUser) {
          return { userId: raceUser.id, email: raceUser.email };
        }
      }
      throw error;
    }
  }

  /**
   * Issues a signed JWT for an already-validated user.
   *
   * @param user - A minimal user object with `userId` and `email`.
   * @returns An object containing the signed `accessToken` string.
   */
  async login(user: { userId: string; email: string }) {
    const payload = { subject: user.userId, email: user.email };
    return { accessToken: this.jwtService.sign(payload) };
  }

  /**
   * Generates a 24-hour verification token and emails it to the user.
   * Called after registration and when the user manually requests a resend.
   *
   * @param userId - The UUID of the user whose email should be verified.
   * @throws {NotFoundException} When no user exists with the given ID.
   */
  async sendVerificationEmail(userId: string) {
    const user = await this.usersService.findById(userId);
    const token = generateToken();
    const expiresAt = expiresInMs(TWENTY_FOUR_HOURS_MS);

    await this.usersService.updateVerificationToken(userId, token, expiresAt);
    await this.emailService.sendVerificationEmail(user.email, token);
  }

  /**
   * Marks a user's email as verified by consuming the one-time token stored
   * in the database. Clears the token after successful use to prevent replay.
   *
   * @param token - The 64-character hex token from the verification link.
   * @throws {BadRequestException} When the token is not found or has expired.
   */
  async verifyEmail(token: string) {
    const user = await this.usersService.findByVerificationToken(token);

    if (!user) {
      throw new BadRequestException('Invalid or expired verification link');
    }

    if (
      !user.verificationTokenExpiresAt ||
      user.verificationTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException('Verification link has expired');
    }

    await this.usersService.clearVerificationToken(user.id);
  }

  /**
   * Initiates the password reset flow. Silently returns when the email is not
   * found to prevent user enumeration — the caller always gets a 200 response.
   *
   * The reset token expires in 1 hour (shorter than verification tokens because
   * reset links are higher-risk: they bypass password knowledge entirely).
   *
   * @param email - The email address to send the reset link to.
   */
  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return;

    const token = generateToken();
    const expiresAt = expiresInMs(ONE_HOUR_MS);

    await this.usersService.updateResetToken(user.id, token, expiresAt);
    await this.emailService.sendPasswordResetEmail(email, token);
  }

  /**
   * Completes the password reset flow by validating the token and replacing
   * the user's password hash. Clears the reset token after use.
   *
   * @param token - The 64-character hex token from the reset email link.
   * @param newPassword - The new plain-text password (hashed here at cost 12).
   * @throws {BadRequestException} When the token is invalid or has expired.
   */
  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersService.findByResetToken(token);

    if (!user) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      throw new BadRequestException('Password reset link has expired');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await this.usersService.resetPasswordWithToken(user.id, newPasswordHash);
  }

  /**
   * Re-sends the verification email to an already-authenticated but unverified user.
   * Issues a fresh 24-hour token, replacing any previously issued one.
   *
   * @param userId - The UUID of the requesting user (from JWT).
   * @throws {BadRequestException} When the email is already verified.
   * @throws {NotFoundException} When no user exists with the given ID.
   */
  async resendVerificationEmail(userId: string) {
    const user = await this.usersService.findById(userId);

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email is already verified');
    }

    const token = generateToken();
    const expiresAt = expiresInMs(TWENTY_FOUR_HOURS_MS);

    await this.usersService.updateVerificationToken(userId, token, expiresAt);
    await this.emailService.sendVerificationEmail(user.email, token);
  }

  /**
   * Begins an email change by storing the new address in `pendingEmail` and
   * sending a verification link to that new address. The user's current email
   * stays active until `confirmEmailChange` is called.
   *
   * @param userId - The UUID of the authenticated user.
   * @param newEmail - The email address the user wants to switch to.
   * @throws {ConflictException} When `newEmail` is already registered to a different account.
   */
  async requestEmailChange(userId: string, newEmail: string) {
    const existing = await this.usersService.findByEmail(newEmail);
    if (existing && existing.id !== userId) {
      throw new ConflictException('Email already in use');
    }

    const token = generateToken();
    const expiresAt = expiresInMs(TWENTY_FOUR_HOURS_MS);

    await this.usersService.updatePendingEmail(
      userId,
      newEmail,
      token,
      expiresAt,
    );
    await this.emailService.sendEmailChangeVerificationEmail(newEmail, token);
  }

  /**
   * Completes the email change flow by promoting `pendingEmail` to the
   * user's primary email. Also marks the email as verified and clears all
   * related token fields.
   *
   * @param token - The 64-character hex token from the email change link.
   * @throws {BadRequestException} When the token is invalid, expired, or `pendingEmail` is missing.
   */
  async confirmEmailChange(token: string) {
    const user = await this.usersService.findByPendingEmailToken(token);

    if (!user) {
      throw new BadRequestException('Invalid or expired email change link');
    }

    if (
      !user.pendingEmailTokenExpiresAt ||
      user.pendingEmailTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException('Email change link has expired');
    }

    if (!user.pendingEmail) {
      throw new BadRequestException('Invalid or expired email change link');
    }

    await this.usersService.confirmPendingEmail(user.id, user.pendingEmail);
  }
}
