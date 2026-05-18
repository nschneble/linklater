import type { EmailPalette } from '../email-palette.js';
import { baseHtml } from './base.html.js';

export const text = (url: string) =>
  `Log in to Linklater by visiting: ${url}\n\nThis link expires in 15 minutes.`;

export const html = (url: string, palette: EmailPalette) =>
  baseHtml({
    heading: 'Your login link.',
    bodyText:
      'Click the button below to log in. This link expires in 15 minutes.',
    buttonLabel: 'Log in to Linklater',
    buttonUrl: url,
    footerNote:
      'If you did not request this login link, you can safely ignore this email.',
    palette,
  });
