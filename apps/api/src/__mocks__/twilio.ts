/**
 * Manual Jest mock for the `twilio` npm package.
 * Provides a minimal stub of the Twilio client used by SmsService.
 * Individual tests override mock implementations via jest.fn() callbacks.
 */

import { jest } from '@jest/globals';

const mockVerifications = { create: jest.fn() };
const mockVerificationChecks = { create: jest.fn() };
const mockService = {
  verifications: mockVerifications,
  verificationChecks: mockVerificationChecks,
};
const mockVerify = { v2: { services: jest.fn().mockReturnValue(mockService) } };
export const mockTwilioClient = { verify: mockVerify };

const twilioConstructor = jest.fn().mockReturnValue(mockTwilioClient);

export default twilioConstructor;
export { mockVerifications, mockVerificationChecks, mockVerify };
