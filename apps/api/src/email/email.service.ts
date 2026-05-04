import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  private readonly from =
    process.env.SMTP_FROM ?? 'Linklater <noreply@linklater.app>';

  async sendVerificationEmail(email: string, token: string) {
    const verifyUrl = `${process.env.APP_URL}/verify-email?token=${token}`;

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Verify your Linklater email',
      text: `Verify your email by visiting: ${verifyUrl}\n\nThis link expires in 24 hours.`,
      html: `<p>Verify your email by clicking <a href="${verifyUrl}">this link</a>.</p><p>This link expires in 24 hours.</p>`,
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Reset your Linklater password',
      text: `Reset your password by visiting: ${resetUrl}\n\nThis link expires in 1 hour.`,
      html: `<p>Reset your password by clicking <a href="${resetUrl}">this link</a>.</p><p>This link expires in 1 hour.</p>`,
    });
  }
}
