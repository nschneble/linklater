import { jest } from '@jest/globals';

import { EmailQueueService, type EmailJob } from './email-queue.service';
import { EmailService } from './email.service';
import { QueueService } from '../queue/queue.service';
import { QUEUES } from '../queue/queue.constants';
import { Test, TestingModule } from '@nestjs/testing';

const EMAIL = 'user@example.com';
const TOKEN = 'a'.repeat(64);
const THEME = 'scanner-darkly';
const WORKER_ID = 'worker-1';

const RETRY_OPTIONS = { retryLimit: 3, retryDelay: 5, retryBackoff: true };

describe('EmailQueueService', () => {
  let service: EmailQueueService;

  const queueServiceMock = {
    send: jest.fn(),
    work: jest.fn(),
  } as unknown as QueueService;

  const emailServiceMock = {
    sendAccountDeletionConfirmation: jest.fn(),
    sendEmailChangeVerification: jest.fn(),
    sendMagicLink: jest.fn(),
    sendPasswordReset: jest.fn(),
    sendVerification: jest.fn(),
  } as unknown as EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailQueueService,
        { provide: QueueService, useValue: queueServiceMock },
        { provide: EmailService, useValue: emailServiceMock },
      ],
    }).compile();

    service = module.get<EmailQueueService>(EmailQueueService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enqueue methods', () => {
    it('enqueues a verification job with the retry policy and never sends inline', async () => {
      await service.enqueueVerification(EMAIL, TOKEN, THEME);

      expect(queueServiceMock.send).toHaveBeenCalledWith(
        QUEUES.EMAIL_SEND,
        { kind: 'verification', email: EMAIL, token: TOKEN, theme: THEME },
        RETRY_OPTIONS,
      );
      // The SMTP send is deferred to the worker – enqueuing must not touch the
      // transport, so a slow or down relay cannot block the caller.
      expect(emailServiceMock.sendVerification).not.toHaveBeenCalled();
    });

    it('enqueues a password-reset job', async () => {
      await service.enqueuePasswordReset(EMAIL, TOKEN, THEME);

      expect(queueServiceMock.send).toHaveBeenCalledWith(
        QUEUES.EMAIL_SEND,
        { kind: 'password-reset', email: EMAIL, token: TOKEN, theme: THEME },
        RETRY_OPTIONS,
      );
    });

    it('enqueues an email-change job', async () => {
      await service.enqueueEmailChangeVerification(EMAIL, TOKEN, THEME);

      expect(queueServiceMock.send).toHaveBeenCalledWith(
        QUEUES.EMAIL_SEND,
        { kind: 'email-change', email: EMAIL, token: TOKEN, theme: THEME },
        RETRY_OPTIONS,
      );
    });

    it('enqueues a magic-link job', async () => {
      await service.enqueueMagicLink(EMAIL, TOKEN, THEME);

      expect(queueServiceMock.send).toHaveBeenCalledWith(
        QUEUES.EMAIL_SEND,
        { kind: 'magic-link', email: EMAIL, token: TOKEN, theme: THEME },
        RETRY_OPTIONS,
      );
    });

    it('enqueues an account-deletion job', async () => {
      await service.enqueueAccountDeletionConfirmation(EMAIL, TOKEN, THEME);

      expect(queueServiceMock.send).toHaveBeenCalledWith(
        QUEUES.EMAIL_SEND,
        { kind: 'account-deletion', email: EMAIL, token: TOKEN, theme: THEME },
        RETRY_OPTIONS,
      );
    });

    it('resolves even when the underlying transport would fail', async () => {
      // Simulate a dead SMTP relay: the eventual send would reject. Enqueuing
      // must still resolve, because it does not perform the send.
      (emailServiceMock.sendVerification as jest.Mock).mockRejectedValue(
        new Error('SMTP down') as never,
      );

      await expect(
        service.enqueueVerification(EMAIL, TOKEN, THEME),
      ).resolves.toBeUndefined();
      expect(emailServiceMock.sendVerification).not.toHaveBeenCalled();

      // clearAllMocks() clears call history but not implementations, so restore
      // the resolving default to avoid leaking the rejection into later tests.
      (emailServiceMock.sendVerification as jest.Mock).mockReset();
    });
  });

  describe('worker', () => {
    const captureHandler = () => {
      let handler: ((jobs: { data: EmailJob }[]) => Promise<void>) | null =
        null;
      (queueServiceMock.work as jest.Mock).mockImplementation(
        (_queue: unknown, callback: unknown) => {
          handler = callback as (jobs: { data: EmailJob }[]) => Promise<void>;
          return Promise.resolve(WORKER_ID);
        },
      );
      return () => handler;
    };

    it('registers a worker on the EMAIL_SEND queue on init', async () => {
      (queueServiceMock.work as jest.Mock).mockResolvedValue(
        WORKER_ID as never,
      );

      await service.onModuleInit();

      expect(queueServiceMock.work).toHaveBeenCalledWith(
        QUEUES.EMAIL_SEND,
        expect.any(Function),
      );
    });

    it('dispatches each job kind to the matching EmailService method', async () => {
      const getHandler = captureHandler();
      await service.onModuleInit();
      const handler = getHandler();
      expect(handler).not.toBeNull();

      await handler!([
        {
          data: {
            kind: 'verification',
            email: EMAIL,
            token: TOKEN,
            theme: THEME,
          },
        },
      ]);
      await handler!([
        {
          data: {
            kind: 'password-reset',
            email: EMAIL,
            token: TOKEN,
            theme: THEME,
          },
        },
      ]);
      await handler!([
        {
          data: {
            kind: 'email-change',
            email: EMAIL,
            token: TOKEN,
            theme: THEME,
          },
        },
      ]);
      await handler!([
        {
          data: {
            kind: 'magic-link',
            email: EMAIL,
            token: TOKEN,
            theme: THEME,
          },
        },
      ]);
      await handler!([
        {
          data: {
            kind: 'account-deletion',
            email: EMAIL,
            token: TOKEN,
            theme: THEME,
          },
        },
      ]);

      expect(emailServiceMock.sendVerification).toHaveBeenCalledWith(
        EMAIL,
        TOKEN,
        THEME,
      );
      expect(emailServiceMock.sendPasswordReset).toHaveBeenCalledWith(
        EMAIL,
        TOKEN,
        THEME,
      );
      expect(emailServiceMock.sendEmailChangeVerification).toHaveBeenCalledWith(
        EMAIL,
        TOKEN,
        THEME,
      );
      expect(emailServiceMock.sendMagicLink).toHaveBeenCalledWith(
        EMAIL,
        TOKEN,
        THEME,
      );
      expect(
        emailServiceMock.sendAccountDeletionConfirmation,
      ).toHaveBeenCalledWith(EMAIL, TOKEN, THEME);
    });

    it('propagates a transport failure so pg-boss retries the job', async () => {
      const getHandler = captureHandler();
      (emailServiceMock.sendVerification as jest.Mock).mockRejectedValue(
        new Error('SMTP down') as never,
      );

      await service.onModuleInit();
      const handler = getHandler();

      await expect(
        handler!([
          {
            data: {
              kind: 'verification',
              email: EMAIL,
              token: TOKEN,
              theme: THEME,
            },
          },
        ]),
      ).rejects.toThrow('SMTP down');

      (emailServiceMock.sendVerification as jest.Mock).mockReset();
    });

    it('drops an unknown job kind without throwing (no infinite retry)', async () => {
      const getHandler = captureHandler();
      await service.onModuleInit();
      const handler = getHandler();

      await expect(
        handler!([
          { data: { kind: 'unknown', email: EMAIL, token: TOKEN } as EmailJob },
        ]),
      ).resolves.toBeUndefined();
      expect(emailServiceMock.sendVerification).not.toHaveBeenCalled();
    });
  });
});
