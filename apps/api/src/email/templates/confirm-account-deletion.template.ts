import { baseHtml } from './base.html.js';
import type { EmailPalette } from '../email-palette.js';

// the 15-minute copy in both bodies tracks the account-deletion token TTL
// in the auth service; nothing enforces the match
export const text = (url: string) =>
  `You requested to permanently delete your Linklater account. Click the link below to confirm. This link expires in 15 minutes.\n\n${url}\n\nIf you did not request this, ignore this email and your account stays as-is.`;

export const html = (url: string, palette: EmailPalette) =>
  baseHtml({
    heading: 'Confirm account deletion.',
    bodyText:
      'You requested to permanently delete your Linklater account. Click the button below to confirm. This link expires in 15 minutes.',
    buttonLabel: 'Permanently delete my account',
    buttonUrl: url,
    footerNote:
      'If you did not request this, ignore this email and your account stays as-is.',
    palette,
  });
