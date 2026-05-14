import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import twilio from 'twilio';

/**
 * Wraps the Twilio Verify API to send and check SMS verification codes.
 *
 * When Twilio credentials are not configured, a warning is logged but the
 * service does not crash on startup. Callers receive a 503 when methods are
 * invoked without credentials.
 */
@Injectable()
export class SmsService {
  private readonly client: twilio.Twilio | null;
  private readonly serviceSid: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID ?? '';

    if (!accountSid || !authToken || !this.serviceSid) {
      console.warn(
        '[SmsService] Twilio credentials not configured — SMS endpoints will fail at runtime',
      );
    }

    this.client =
      accountSid && authToken ? twilio(accountSid, authToken) : null;
  }

  /**
   * Sends an SMS verification code to the given phone number via Twilio Verify.
   *
   * @param phoneNumber - The E.164-formatted phone number to send the code to.
   * @throws {ServiceUnavailableException} When Twilio credentials are not configured.
   * @throws When the Twilio API call fails.
   */
  async sendVerification(phoneNumber: string): Promise<void> {
    if (!this.client) {
      throw new ServiceUnavailableException('SMS service is not configured');
    }
    await this.client.verify.v2
      .services(this.serviceSid)
      .verifications.create({ to: phoneNumber, channel: 'sms' });
  }

  /**
   * Checks whether a user-supplied code matches the verification sent to a phone.
   *
   * @param phoneNumber - The E.164-formatted phone number the code was sent to.
   * @param code - The 6-digit code entered by the user.
   * @returns `true` when the code is correct, `false` otherwise.
   * @throws {ServiceUnavailableException} When Twilio credentials are not configured.
   * @throws When the Twilio API call fails.
   */
  async checkVerification(phoneNumber: string, code: string): Promise<boolean> {
    if (!this.client) {
      throw new ServiceUnavailableException('SMS service is not configured');
    }
    const check = await this.client.verify.v2
      .services(this.serviceSid)
      .verificationChecks.create({ to: phoneNumber, code });
    return check.status === 'approved';
  }
}
