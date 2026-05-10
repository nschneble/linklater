import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * Sends transactional emails via SMTP. Configuration is read from environment
 * variables at startup (see `apps/api/README.md` for the full list).
 *
 * All public methods follow the same pattern: build the email options and
 * delegate to the private `send` wrapper which handles errors uniformly.
 *
 * NOTE: When no SMTP credentials are configured (e.g. in local development),
 * nodemailer will still attempt to connect and will throw — run a local SMTP
 * server like Mailpit (`brew install mailpit`) to catch emails in development.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private readonly transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  /** The "From" address shown in outgoing emails. Defaults to `Linklater <noreply@linklater.app>`. */
  private readonly from =
    process.env.SMTP_FROM ?? 'Linklater <noreply@linklater.app>';

  /**
   * Internal helper that wraps nodemailer's `sendMail` with error handling.
   * Converts SMTP failures into a 503 Service Unavailable so the caller
   * receives a meaningful HTTP error rather than an uncaught exception.
   *
   * @param options - Standard nodemailer `SendMailOptions`.
   * @throws {ServiceUnavailableException} When nodemailer fails to send the email.
   */
  private async send(options: nodemailer.SendMailOptions) {
    try {
      await this.transporter.sendMail(options);
    } catch (error: unknown) {
      this.logger.error('Failed to send email', error);
      throw new ServiceUnavailableException(
        'Failed to send email. Please try again later.',
      );
    }
  }

  /**
   * Sends an email verification link to a new or unverified user.
   * The link contains a 64-character hex token and expires in 24 hours.
   *
   * Endpoint consumed by the link: POST /auth/verify-email
   *
   * @param email - The recipient's email address.
   * @param token - The 64-character hex verification token.
   */
  async sendVerificationEmail(email: string, token: string) {
    const verifyUrl = `${process.env.APP_URL}/verify-email?token=${token}`;

    await this.send({
      from: this.from,
      to: email,
      subject: 'Verify your Linklater email',
      text: `Verify your email by visiting: ${verifyUrl}\n\nThis link expires in 24 hours.`,
      html: `<p>Verify your email by clicking <a href="${verifyUrl}">this link</a>.</p><p>This link expires in 24 hours.</p>`,
    });
  }

  /**
   * Sends a password reset link to the given email address.
   * The link contains a 64-character hex token and expires in 1 hour.
   *
   * Endpoint consumed by the link: POST /auth/reset-password
   *
   * @param email - The recipient's email address.
   * @param token - The 64-character hex reset token.
   */
  async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;

    await this.send({
      from: this.from,
      to: email,
      subject: 'Reset your Linklater password',
      text: `Reset your password by visiting: ${resetUrl}\n\nThis link expires in 1 hour.`,
      html: `<p>Reset your password by clicking <a href="${resetUrl}">this link</a>.</p><p>This link expires in 1 hour.</p>`,
    });
  }

  /**
   * Sends a verification link to a user's *new* email address to confirm an
   * email change. The link contains a 64-character hex token and expires in 24 hours.
   *
   * Endpoint consumed by the link: POST /auth/verify-email-change
   *
   * @param email - The new (pending) email address to send the link to.
   * @param token - The 64-character hex email-change verification token.
   */
  async sendEmailChangeVerificationEmail(email: string, token: string) {
    const verifyUrl = `${process.env.APP_URL}/verify-email-change?token=${token}`;

    await this.send({
      from: this.from,
      to: email,
      subject: 'Confirm your new Linklater email',
      text: `Confirm your new email address by visiting: ${verifyUrl}\n\nThis link expires in 24 hours.`,
      html: `<p>Confirm your new email address by clicking <a href="${verifyUrl}">this link</a>.</p><p>This link expires in 24 hours.</p>`,
    });
  }
}
