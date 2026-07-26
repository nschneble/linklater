import { baseHtml } from './base.html.js';
import type { EmailPalette } from '../email-palette.js';

export const text = (url: string, effectiveDate: string) =>
  `We are updating the Linklater privacy policy. The new version takes effect on ${effectiveDate}.\n\nRead it here: ${url}\n\nIf you keep using Linklater after that date, the new policy applies. If you disagree with the changes, you can delete your account from Settings before then.`;

export const html = (
  url: string,
  effectiveDate: string,
  palette: EmailPalette,
) =>
  baseHtml({
    heading: 'Our privacy policy is changing.',
    bodyText: `We are updating the Linklater privacy policy. The new version takes effect on ${effectiveDate}. If you keep using Linklater after that date, the new policy applies; if you disagree with the changes, you can delete your account from Settings before then.`,
    buttonLabel: 'Read the Policy',
    buttonUrl: url,
    footerNote:
      'You are receiving this one-time notice because you have a Linklater account. There is nothing you need to do.',
    palette,
  });
