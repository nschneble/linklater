import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { EmailService } from '../email/index.js';
import { UsersService, withoutPasswordHash } from '../users/index.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;

    return withoutPasswordHash(user);
  }

  async login(user: { userId: string; email: string }) {
    const payload = { subject: user.userId, email: user.email };
    return { accessToken: this.jwtService.sign(payload) };
  }

  async sendVerificationEmail(userId: string) {
    const user = await this.usersService.findById(userId);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.usersService.updateVerificationToken(userId, token, expiresAt);
    await this.emailService.sendVerificationEmail(user.email, token);
  }

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

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return;

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.usersService.updateResetToken(user.id, token, expiresAt);
    await this.emailService.sendPasswordResetEmail(email, token);
  }

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

  async resendVerificationEmail(userId: string) {
    const user = await this.usersService.findById(userId);

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email is already verified');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.usersService.updateVerificationToken(userId, token, expiresAt);
    await this.emailService.sendVerificationEmail(user.email, token);
  }

  async requestEmailChange(userId: string, newEmail: string) {
    const existing = await this.usersService.findByEmail(newEmail);
    if (existing && existing.id !== userId) {
      throw new ConflictException('Email already in use');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.usersService.updatePendingEmail(userId, newEmail, token, expiresAt);
    await this.emailService.sendEmailChangeVerificationEmail(newEmail, token);
  }

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
