import { EmailService } from './email.service.js';
import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';

const USER_EMAIL = 'user@example.com';
const VERIFICATION_TOKEN = 'verify-token-abc';
const RESET_TOKEN = 'reset-token-xyz';

describe('EmailService', () => {
  let service: EmailService;
  let sendMailMock: jest.Mock;
  let logMock: jest.SpiedFunction<(...args: unknown[]) => void>;
  const originalTestingUi = process.env.TESTING_UI;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile();

    service = module.get<EmailService>(EmailService);

    sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-id' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceAsAny = service as any;
    serviceAsAny.transporter.sendMail = sendMailMock;
    jest
      .spyOn(serviceAsAny.logger, 'error')
      .mockImplementation(() => undefined);
    logMock = jest
      .spyOn(serviceAsAny.logger, 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (originalTestingUi === undefined) {
      delete process.env.TESTING_UI;
    } else {
      process.env.TESTING_UI = originalTestingUi;
    }
  });

  describe('sendVerification', () => {
    it('sends to the correct recipient with the verification subject', async () => {
      await service.sendVerification(USER_EMAIL, VERIFICATION_TOKEN);

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: USER_EMAIL,
          subject: 'Verify your Linklater email',
        }),
      );
    });

    it('includes the token in the email body', async () => {
      process.env.APP_URL = 'https://app.example.com';

      await service.sendVerification(USER_EMAIL, VERIFICATION_TOKEN);

      const [mailOptions] = sendMailMock.mock.calls[0] as [
        { text: string; html: string },
      ];
      expect(mailOptions.text).toContain(VERIFICATION_TOKEN);
      expect(mailOptions.html).toContain(VERIFICATION_TOKEN);
    });

    it('mentions the 24-hour expiry in the email body', async () => {
      await service.sendVerification(USER_EMAIL, VERIFICATION_TOKEN);

      const [mailOptions] = sendMailMock.mock.calls[0] as [{ text: string }];
      expect(mailOptions.text).toContain('24 hours');
    });
  });

  describe('sendPolicyUpdate', () => {
    const EFFECTIVE_DATE = 'August 15, 2026';

    it('sends to the correct recipient with the policy-update subject', async () => {
      await service.sendPolicyUpdate(USER_EMAIL, EFFECTIVE_DATE);

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: USER_EMAIL,
          subject: 'The Linklater privacy policy is changing',
        }),
      );
    });

    it('includes the effective date and the /privacy link in the body', async () => {
      process.env.APP_URL = 'https://app.example.com';

      await service.sendPolicyUpdate(USER_EMAIL, EFFECTIVE_DATE);

      const [mailOptions] = sendMailMock.mock.calls[0] as [
        { text: string; html: string },
      ];
      expect(mailOptions.text).toContain(EFFECTIVE_DATE);
      expect(mailOptions.text).toContain('https://app.example.com/privacy');
      expect(mailOptions.html).toContain(EFFECTIVE_DATE);
      expect(mailOptions.html).toContain('https://app.example.com/privacy');
    });
  });

  describe('sendPasswordReset', () => {
    it('sends to the correct recipient with the reset subject', async () => {
      await service.sendPasswordReset(USER_EMAIL, RESET_TOKEN);

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: USER_EMAIL,
          subject: 'Reset your Linklater password',
        }),
      );
    });

    it('includes the token in the email body', async () => {
      process.env.APP_URL = 'https://app.example.com';

      await service.sendPasswordReset(USER_EMAIL, RESET_TOKEN);

      const [mailOptions] = sendMailMock.mock.calls[0] as [
        { text: string; html: string },
      ];
      expect(mailOptions.text).toContain(RESET_TOKEN);
      expect(mailOptions.html).toContain(RESET_TOKEN);
    });

    it('mentions the 1-hour expiry in the email body', async () => {
      await service.sendPasswordReset(USER_EMAIL, RESET_TOKEN);

      const [mailOptions] = sendMailMock.mock.calls[0] as [{ text: string }];
      expect(mailOptions.text).toContain('1 hour');
    });

    it('throws ServiceUnavailableException when SMTP fails', async () => {
      const { ServiceUnavailableException } = await import('@nestjs/common');
      sendMailMock.mockRejectedValue(new Error('SMTP connection refused'));

      await expect(
        service.sendPasswordReset(USER_EMAIL, RESET_TOKEN),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('sendVerification SMTP error', () => {
    it('throws ServiceUnavailableException when SMTP fails', async () => {
      const { ServiceUnavailableException } = await import('@nestjs/common');
      sendMailMock.mockRejectedValue(new Error('SMTP connection refused'));

      await expect(
        service.sendVerification(USER_EMAIL, VERIFICATION_TOKEN),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('sendEmailChangeVerification', () => {
    it('sends to the correct recipient with the email-change subject', async () => {
      await service.sendEmailChangeVerification(USER_EMAIL, VERIFICATION_TOKEN);

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: USER_EMAIL,
          subject: 'Confirm your new Linklater email',
        }),
      );
    });

    it('includes the token and the verify-email-change path in the body', async () => {
      process.env.APP_URL = 'https://app.example.com';

      await service.sendEmailChangeVerification(USER_EMAIL, VERIFICATION_TOKEN);

      const [mailOptions] = sendMailMock.mock.calls[0] as [
        { text: string; html: string },
      ];
      expect(mailOptions.text).toContain(VERIFICATION_TOKEN);
      expect(mailOptions.text).toContain('verify-email-change');
      expect(mailOptions.html).toContain(VERIFICATION_TOKEN);
    });

    it('mentions the 24-hour expiry in the email body', async () => {
      await service.sendEmailChangeVerification(USER_EMAIL, VERIFICATION_TOKEN);

      const [mailOptions] = sendMailMock.mock.calls[0] as [{ text: string }];
      expect(mailOptions.text).toContain('24 hours');
    });

    it('throws ServiceUnavailableException when SMTP fails', async () => {
      const { ServiceUnavailableException } = await import('@nestjs/common');
      sendMailMock.mockRejectedValue(new Error('SMTP connection refused'));

      await expect(
        service.sendEmailChangeVerification(USER_EMAIL, VERIFICATION_TOKEN),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('TESTING_UI bypass', () => {
    beforeEach(() => {
      process.env.TESTING_UI = '1';
    });

    it('skips the SMTP transporter entirely on every send variant', async () => {
      await service.sendVerification(USER_EMAIL, VERIFICATION_TOKEN);
      await service.sendPasswordReset(USER_EMAIL, RESET_TOKEN);
      await service.sendEmailChangeVerification(USER_EMAIL, VERIFICATION_TOKEN);
      await service.sendMagicLink(USER_EMAIL, VERIFICATION_TOKEN);
      await service.sendAccountDeletionConfirmation(
        USER_EMAIL,
        VERIFICATION_TOKEN,
      );

      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it('logs the noop with subject (but never the recipient) so the harness has a trail without leaking PII', async () => {
      await service.sendVerification(USER_EMAIL, VERIFICATION_TOKEN);

      expect(logMock).toHaveBeenCalledWith(
        expect.stringContaining('TESTING_UI=1'),
      );
      const [logMessage] = logMock.mock.calls[0] as [string];
      expect(logMessage).toContain('Verify your Linklater email');
      expect(logMessage).not.toContain(USER_EMAIL);
    });

    it('does not throw ServiceUnavailableException even if the transporter would have', async () => {
      sendMailMock.mockRejectedValue(new Error('SMTP connection refused'));

      await expect(
        service.sendVerification(USER_EMAIL, VERIFICATION_TOKEN),
      ).resolves.toBeUndefined();
    });
  });
});
