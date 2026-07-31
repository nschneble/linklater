import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { isTestingUi } from '../common/index.js';
import { resolveEmailPalette } from './email-palette.js';
import * as ConfirmAccountDeletionTemplate from './templates/confirm-account-deletion.template.js';
import * as EmailChangeTemplate from './templates/email-change.template.js';
import * as MagicLinkTemplate from './templates/magic-link.template.js';
import * as PasswordResetTemplate from './templates/password-reset.template.js';
import * as PolicyUpdateTemplate from './templates/policy-update.template.js';
import * as VerificationTemplate from './templates/verification.template.js';

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
   * Throws on SMTP failure so the caller can react. Every public send method
   * is invoked from the `email-send` pg-boss worker
   * (see {@link EmailQueueService}), never on the request thread, so a thrown
   * failure surfaces to the worker - which lets pg-boss retry the job - rather
   * than to an HTTP handler. The exception type stays
   * `ServiceUnavailableException` for backwards compatibility with callers and
   * tests that assert on it.
   *
   * @param options - Standard nodemailer `SendMailOptions`.
   *
   * @throws {ServiceUnavailableException} When nodemailer fails to send
             the email.
   */
  private async send(options: nodemailer.SendMailOptions) {
    // testing-ui drops emails so the harness needs no SMTP relay
    // log the subject only, never the recipient (avoid leaking addresses)
    if (isTestingUi()) {
      const subject =
        options.subject === undefined
          ? '(no subject)'
          : String(options.subject);
      this.logger.log(`TESTING_UI=1: noop email send subject=${subject}`);
      return;
    }
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

  /**
   * Sends a magic link login email. The link contains a 64-character hex token
   * that expires in 15 minutes.
   *
   * @param email - The recipient's email address.
   * @param token - The 64-character hex magic link token.
   * @param theme - The user's saved theme name; falls back to scanner-darkly.
   */
  async sendMagicLink(email: string, token: string, theme?: string) {
    const url = `${process.env.APP_URL}/verify-login?token=${token}`;
    const palette = resolveEmailPalette(theme ?? 'scanner-darkly');

    await this.send({
      from: this.from,
      to: email,
      subject: 'Your Linklater login link',
      text: MagicLinkTemplate.text(url),
      html: MagicLinkTemplate.html(url, palette),
    });
  }

  /**
   * Sends an account-deletion confirmation email. The link contains a
   * 64-character hex token that expires in 15 minutes. Clicking it
   * permanently deletes the user's account.
   *
   * @param email - The recipient's email address.
   * @param token - The 64-character hex confirmation token.
   * @param theme - The user's saved theme name; falls back to scanner-darkly.
   */
  async sendAccountDeletionConfirmation(
    email: string,
    token: string,
    theme?: string,
  ) {
    const url = `${process.env.APP_URL}/account/confirm-deletion?token=${token}`;
    const palette = resolveEmailPalette(theme ?? 'scanner-darkly');

    await this.send({
      from: this.from,
      to: email,
      subject: 'Confirm your Linklater account deletion',
      text: ConfirmAccountDeletionTemplate.text(url),
      html: ConfirmAccountDeletionTemplate.html(url, palette),
    });
  }

  /**
   * Sends a one-time notice that the privacy policy is changing (the policy
   * itself promises email notice before material changes take effect). The
   * link points at the public /privacy page — no token involved.
   *
   * @param email - The recipient's email address.
   * @param effectiveDate - Human-readable date the new policy takes effect.
   * @param theme - The user's saved theme name; falls back to scanner-darkly.
   */
  async sendPolicyUpdate(email: string, effectiveDate: string, theme?: string) {
    const url = `${process.env.APP_URL}/privacy`;
    const palette = resolveEmailPalette(theme ?? 'scanner-darkly');

    await this.send({
      from: this.from,
      to: email,
      subject: 'The Linklater privacy policy is changing',
      text: PolicyUpdateTemplate.text(url, effectiveDate),
      html: PolicyUpdateTemplate.html(url, effectiveDate, palette),
    });
  }
}
