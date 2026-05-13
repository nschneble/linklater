import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { resolveEmailPalette } from './email-palette.js';
import * as EmailChangeTemplate from './templates/email-change.template.js';
import * as PasswordResetTemplate from './templates/password-reset.template.js';
import * as VerificationTemplate from './templates/verification.template.js';
import * as nodemailer from 'nodemailer';

/**
 * Sends transactional emails via SMTP. Configuration is read from
 * environment variables at startup. See `apps/api/README.md` for the full
 * list.
 *
 * All public methods follow the same pattern: build the email options and
 * delegate to the private `send` wrapper which handles errors uniformly.
 *
 * NOTE: When no SMTP credentials are configured (e.g. in development),
 * nodemailer will still attempt to connect and will throw errors. Run a
 * local SMTP server like Mailpit to catch emails in development.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private readonly transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    ...(process.env.SMTP_USER && {
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    }),
  });

  /**
   * The "From" address shown in outgoing emails. Defaults to
   * `Linklater <noreply@linklater.app>`.
   */
  private readonly from =
    process.env.SMTP_FROM ?? 'Linklater <noreply@linklater.app>';

  /**
   * Internal helper that wraps nodemailer's `sendMail` w/ error handling.
   * Converts SMTP failures into a 503 Service Unavailable so the caller
   * receives a meaningful HTTP error rather than an uncaught exception.
   *
   * @param options - Standard nodemailer `SendMailOptions`.
   *
   * @throws {ServiceUnavailableException} When nodemailer fails to send
             the email.
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
   * Sends a verification email to a new (or unverified) user. The link
   * contains a 64-character hex token that expires in 24 hours.
   *
   * Endpoint(s) consumed by the link: POST /auth/verify-email
   *
   * @param email - The recipient's email address.
   * @param token - The 64-character hex verification token.
   * @param theme - The user's saved theme name; falls back to scanner-darkly.
   */
  async sendVerification(email: string, token: string, theme?: string) {
    const url = `${process.env.APP_URL}/verify-email?token=${token}`;
    const palette = resolveEmailPalette(theme ?? 'scanner-darkly');

    await this.send({
      from: this.from,
      to: email,
      subject: 'Verify your Linklater email',
      text: VerificationTemplate.text(url),
      html: VerificationTemplate.html(url, palette),
    });
  }

  /**
   * Sends a password reset to the given email address. The link contains
   * a 64-character hex token that expires in 1 hour.
   *
   * Endpoint(s) consumed by the link: POST /auth/reset-password
   *
   * @param email - The recipient's email address.
   * @param token - The 64-character hex reset token.
   * @param theme - The user's saved theme name; falls back to scanner-darkly.
   */
  async sendPasswordReset(email: string, token: string, theme?: string) {
    const url = `${process.env.APP_URL}/reset-password?token=${token}`;
    const palette = resolveEmailPalette(theme ?? 'scanner-darkly');

    await this.send({
      from: this.from,
      to: email,
      subject: 'Reset your Linklater password',
      text: PasswordResetTemplate.text(url),
      html: PasswordResetTemplate.html(url, palette),
    });
  }

  /**
   * Sends a verification to a user's *new* email address to confirm an
   * email change. The link contains a 64-character hex token that expires
   * in 24 hours.
   *
   * Endpoint(s) consumed by the link: POST /auth/verify-email-change
   *
   * @param email - The new (pending) email address to send the link to.
   * @param token - The 64-character hex email-change verification token.
   * @param theme - The user's saved theme name; falls back to scanner-darkly.
   */
  async sendEmailChangeVerification(
    email: string,
    token: string,
    theme?: string,
  ) {
    const url = `${process.env.APP_URL}/verify-email-change?token=${token}`;
    const palette = resolveEmailPalette(theme ?? 'scanner-darkly');

    await this.send({
      from: this.from,
      to: email,
      subject: 'Confirm your new Linklater email',
      text: EmailChangeTemplate.text(url),
      html: EmailChangeTemplate.html(url, palette),
    });
  }
}
