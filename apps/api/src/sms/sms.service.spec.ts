import { jest } from '@jest/globals';

// Set env vars before importing SmsService
process.env.TWILIO_ACCOUNT_SID = 'ACtest';
process.env.TWILIO_AUTH_TOKEN = 'test-token';
process.env.TWILIO_VERIFY_SERVICE_SID = 'VAtest';

import {
  mockVerifications,
  mockVerificationChecks,
  mockVerify,
} from '../__mocks__/twilio';
import { SmsService } from './sms.service';

const PHONE_NUMBER = '+15555550100';
const CODE = '123456';

describe('SmsService', () => {
  let service: SmsService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore services mock implementation after clearAllMocks
    (mockVerify.v2.services as jest.Mock).mockReturnValue({
      verifications: mockVerifications,
      verificationChecks: mockVerificationChecks,
    });
    service = new SmsService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendVerification', () => {
    it('calls verifications.create with the phone number and sms channel', async () => {
      (mockVerifications.create as jest.Mock).mockResolvedValue({});

      await service.sendVerification(PHONE_NUMBER);

      expect(mockVerify.v2.services).toHaveBeenCalledWith('VAtest');
      expect(mockVerifications.create).toHaveBeenCalledWith({
        to: PHONE_NUMBER,
        channel: 'sms',
      });
    });

    it('propagates errors from the Twilio client', async () => {
      const twilioError = new Error('Twilio API error');
      (mockVerifications.create as jest.Mock).mockRejectedValue(twilioError);

      await expect(service.sendVerification(PHONE_NUMBER)).rejects.toThrow(
        'Twilio API error',
      );
    });
  });

  describe('checkVerification', () => {
    it('returns true when verification status is approved', async () => {
      (mockVerificationChecks.create as jest.Mock).mockResolvedValue({
        status: 'approved',
      });

      const result = await service.checkVerification(PHONE_NUMBER, CODE);

      expect(mockVerify.v2.services).toHaveBeenCalledWith('VAtest');
      expect(mockVerificationChecks.create).toHaveBeenCalledWith({
        to: PHONE_NUMBER,
        code: CODE,
      });
      expect(result).toBe(true);
    });

    it('returns false when verification status is pending', async () => {
      (mockVerificationChecks.create as jest.Mock).mockResolvedValue({
        status: 'pending',
      });

      const result = await service.checkVerification(PHONE_NUMBER, CODE);

      expect(result).toBe(false);
    });

    it('propagates errors from the Twilio client', async () => {
      const twilioError = new Error('Twilio check failed');
      (mockVerificationChecks.create as jest.Mock).mockRejectedValue(
        twilioError,
      );

      await expect(
        service.checkVerification(PHONE_NUMBER, CODE),
      ).rejects.toThrow('Twilio check failed');
    });
  });
});
