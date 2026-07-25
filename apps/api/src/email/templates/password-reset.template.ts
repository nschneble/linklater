import { baseHtml } from './base.html.js';
import type { EmailPalette } from '../email-palette.js';

export const text = (url: string) =>
  `Reset your Linklater password by visiting: ${url}\n\nThis link expires in 1 hour.`;

export const html = (url: string, palette: EmailPalette) =>
  baseHtml({
    heading: 'Reset your password.',
    bodyText: 'To reset your Linklater password, click the button below.',
    buttonLabel: 'Reset Password',
    buttonUrl: url,
    footerNote:
      'This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.',
    palette,
  });
