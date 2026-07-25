import { baseHtml } from './base.html.js';
import type { EmailPalette } from '../email-palette.js';

/**
 * Generates the plain-text body for a magic-link login email.
 *
 * Used as the fallback for email clients that do not render HTML.
 * The link expires after 15 minutes – this matches the JWT TTL
 * set by the auth module.
 * @param url - The fully qualified magic-link URL, including the
 *   signed token as a query parameter.
 * @returns A plain-text string ready to pass to the mail
 *   transport's `text` field.
 */
export const text = (url: string) =>
  `Log in to Linklater by visiting: ${url}\n\nThis link expires in 15 minutes.`;

/**
 * Generates the HTML body for a magic-link login email using the
 * shared `baseHtml` layout template.
 *
 * The 15-minute expiry message in the body text must stay in sync
 * with the JWT TTL configured in the auth module. If the TTL
 * changes, update both the button copy here and the `text` export
 * above.
 * @param url - The fully qualified magic-link URL, including the
 *   signed token as a query parameter.
 * @param palette - Color values derived from the user's saved theme
 *   preference, used to tint the email to match the app's appearance.
 * @returns An HTML string ready to pass to the mail transport's
 *   `html` field.
 */
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
