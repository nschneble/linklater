import { EmailService } from './email.service.js';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueService, QUEUES } from '../queue/index.js';
import type { SendOptions } from 'pg-boss';

/**
 * Discriminates which transactional email a queued job should send. Every
 * kind maps one-to-one to a public `send*` method on {@link EmailService}.
 */
export type EmailJobKind =
  | 'account-deletion'
  | 'email-change'
  | 'magic-link'
  | 'password-reset'
  | 'policy-update'
  | 'verification';

/**
 * Payload carried on a token-bearing `email-send` job. Holds the
 * already-rendered recipient, the raw single-use token, and the recipient's
 * theme – the exact arguments the matching `EmailService.send*` method needs.
 *
 * NOTE ON THE RAW TOKEN: the token is a short-lived secret whose SHA-256 hash
 * is what lives in the `User` row; the raw value only exists in memory at
 * enqueue time and cannot be re-derived from the database. Because the worker
 * cannot reconstruct it by re-reading the user, it must travel in the job
 * payload. It sits in the `pgboss.job` table only until the job is processed
 * (near-immediately) and archived, and the token itself expires in 15 minutes
 * to 24 hours depending on kind.
 */
export interface TokenEmailJob {
  kind: Exclude<EmailJobKind, 'policy-update'>;
  email: string;
  token: string;
  theme?: string;
}

/**
 * Payload for the privacy-policy change notice. Carries the human-readable
 * effective date instead of a token – the email links to the public /privacy
 * page, so there is no secret to transport.
 */
export interface PolicyUpdateEmailJob {
  kind: 'policy-update';
  email: string;
  effectiveDate: string;
  theme?: string;
}

export type EmailJob = TokenEmailJob | PolicyUpdateEmailJob;

/**
 * Retry policy for the email queue. Transient SMTP failures (relay briefly
 * down, connection reset) should retry rather than strand an un-emailed
 * account, unlike the pg-boss default of zero retries. Three attempts with
 * exponential backoff starting at five seconds.
 */
const EMAIL_SEND_OPTIONS: SendOptions = {
  retryLimit: 3,
  retryDelay: 5,
  retryBackoff: true,
};

/**
 * Enqueues transactional auth emails onto pg-boss and runs the worker that
 * performs the actual SMTP send. Callers enqueue and return immediately, so a
 * slow or unavailable SMTP relay never blocks – or 503s – an auth request.
 *
 * DELIVERY SEMANTICS: pg-boss is at-least-once, and this queue adds retries on
 * top. Re-delivery is safe for every kind here: each email carries a
 * single-use token whose hash is already persisted, so sending the same
 * verification / reset / magic-link / deletion email twice is benign – the
 * link works once and the duplicate is a harmless second copy. The worker lets
 * SMTP failures propagate so pg-boss records the failure and retries per
 * {@link EMAIL_SEND_OPTIONS}; a thrown handler error fails only its own job and
 * never crashes the process.
 */
@Injectable()
export class EmailQueueService implements OnModuleInit {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly emailService: EmailService,
  ) {}

  /** Registers the email-send queue worker on application startup. */
  async onModuleInit(): Promise<void> {
    await this.queueService.work<EmailJob>(QUEUES.EMAIL_SEND, async (jobs) => {
      for (const job of jobs) {
        await this.deliver(job.data);
      }
    });
  }

  /** Enqueues a new-account / resend verification email. */
  async enqueueVerification(
    email: string,
    token: string,
    theme?: string,
  ): Promise<void> {
    await this.enqueue({ kind: 'verification', email, token, theme });
  }

  /** Enqueues a password-reset email. */
  async enqueuePasswordReset(
    email: string,
    token: string,
    theme?: string,
  ): Promise<void> {
    await this.enqueue({ kind: 'password-reset', email, token, theme });
  }

  /** Enqueues an email-change confirmation email (initial or resend). */
  async enqueueEmailChangeVerification(
    email: string,
    token: string,
    theme?: string,
  ): Promise<void> {
    await this.enqueue({ kind: 'email-change', email, token, theme });
  }

  /** Enqueues a magic-link login email (login or signup). */
  async enqueueMagicLink(
    email: string,
    token: string,
    theme?: string,
  ): Promise<void> {
    await this.enqueue({ kind: 'magic-link', email, token, theme });
  }

  /** Enqueues an account-deletion confirmation email. */
  async enqueueAccountDeletionConfirmation(
    email: string,
    token: string,
    theme?: string,
  ): Promise<void> {
    await this.enqueue({ kind: 'account-deletion', email, token, theme });
  }

  /** Enqueues a one-time privacy-policy change notice. */
  async enqueuePolicyUpdate(
    email: string,
    effectiveDate: string,
    theme?: string,
  ): Promise<void> {
    await this.enqueue({ kind: 'policy-update', email, effectiveDate, theme });
  }

  private async enqueue(job: EmailJob): Promise<void> {
    await this.queueService.send(QUEUES.EMAIL_SEND, job, EMAIL_SEND_OPTIONS);
  }

  /**
   * Dispatches a dequeued job to the matching `EmailService.send*` method.
   * Any SMTP failure propagates so pg-boss retries the job.
   */
  private async deliver(job: EmailJob): Promise<void> {
    switch (job.kind) {
      case 'verification':
        await this.emailService.sendVerification(
          job.email,
          job.token,
          job.theme,
        );
        return;
      case 'password-reset':
        await this.emailService.sendPasswordReset(
          job.email,
          job.token,
          job.theme,
        );
        return;
      case 'email-change':
        await this.emailService.sendEmailChangeVerification(
          job.email,
          job.token,
          job.theme,
        );
        return;
      case 'magic-link':
        await this.emailService.sendMagicLink(job.email, job.token, job.theme);
        return;
      case 'account-deletion':
        await this.emailService.sendAccountDeletionConfirmation(
          job.email,
          job.token,
          job.theme,
        );
        return;
      case 'policy-update':
        await this.emailService.sendPolicyUpdate(
          job.email,
          job.effectiveDate,
          job.theme,
        );
        return;
      default: {
        // unknown kind: log and swallow (retry never helps); log the kind only, never the payload (recipient)
        const unknownJob: never = job;
        this.logger.error(
          `Dropping email-send job with unknown kind: ${String(
            (unknownJob as { kind?: unknown }).kind,
          )}`,
        );
      }
    }
  }
}
