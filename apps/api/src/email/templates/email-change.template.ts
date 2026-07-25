import { baseHtml } from './base.html.js';
import type { EmailPalette } from '../email-palette.js';

export const text = (url: string) =>
  `Confirm your new Linklater email address by visiting: ${url}\n\nThis link expires in 24 hours.`;

export const html = (url: string, palette: EmailPalette) =>
  baseHtml({
    heading: 'Confirm your new email.',
    bodyText:
      'Click the button below to confirm your new Linklater email address.',
    buttonLabel: 'Confirm Email',
    buttonUrl: url,
    footerNote:
      'This link expires in 24 hours. If you did not request this change, please contact support immediately.',
    palette,
  });
