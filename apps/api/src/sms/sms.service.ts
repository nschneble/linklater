import { Injectable } from '@nestjs/common';

/**
 * Sends and verifies SMS one-time passcodes via Twilio Verify.
 * The Twilio integration is implemented in Task 12; this stub allows
 * dependent services to compile and be tested with mocks in the interim.
 */
@Injectable()
export class SmsService {
  async sendVerification(_phoneNumber: string): Promise<void> {
    throw new Error('SmsService not yet implemented');
  }

  async checkVerification(
    _phoneNumber: string,
    _code: string,
  ): Promise<boolean> {
    throw new Error('SmsService not yet implemented');
  }
}
