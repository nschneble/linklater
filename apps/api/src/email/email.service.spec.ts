import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service.js';

const USER_EMAIL = 'user@example.com';
const VERIFICATION_TOKEN = 'verify-token-abc';
const RESET_TOKEN = 'reset-token-xyz';

describe('EmailService', () => {
  let service: EmailService;
  let sendMailMock: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile();

    service = module.get<EmailService>(EmailService);

    sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-id' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).transporter.sendMail = sendMailMock;
  });

  describe('sendVerificationEmail', () => {
    it('sends to the correct recipient with the verification subject', async () => {
      await service.sendVerificationEmail(USER_EMAIL, VERIFICATION_TOKEN);

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: USER_EMAIL,
          subject: 'Verify your Linklater email',
        }),
      );
    });

    it('includes the token in the email body', async () => {
      process.env.APP_URL = 'https://app.example.com';

      await service.sendVerificationEmail(USER_EMAIL, VERIFICATION_TOKEN);

      const [mailOptions] = sendMailMock.mock.calls[0] as [
        { text: string; html: string },
      ];
      expect(mailOptions.text).toContain(VERIFICATION_TOKEN);
      expect(mailOptions.html).toContain(VERIFICATION_TOKEN);
    });

    it('mentions the 24-hour expiry in the email body', async () => {
      await service.sendVerificationEmail(USER_EMAIL, VERIFICATION_TOKEN);

      const [mailOptions] = sendMailMock.mock.calls[0] as [{ text: string }];
      expect(mailOptions.text).toContain('24 hours');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends to the correct recipient with the reset subject', async () => {
      await service.sendPasswordResetEmail(USER_EMAIL, RESET_TOKEN);

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: USER_EMAIL,
          subject: 'Reset your Linklater password',
        }),
      );
    });

    it('includes the token in the email body', async () => {
      process.env.APP_URL = 'https://app.example.com';

      await service.sendPasswordResetEmail(USER_EMAIL, RESET_TOKEN);

      const [mailOptions] = sendMailMock.mock.calls[0] as [
        { text: string; html: string },
      ];
      expect(mailOptions.text).toContain(RESET_TOKEN);
      expect(mailOptions.html).toContain(RESET_TOKEN);
    });

    it('mentions the 1-hour expiry in the email body', async () => {
      await service.sendPasswordResetEmail(USER_EMAIL, RESET_TOKEN);

      const [mailOptions] = sendMailMock.mock.calls[0] as [{ text: string }];
      expect(mailOptions.text).toContain('1 hour');
    });
  });
});
