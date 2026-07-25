import { baseHtml } from './base.html.js';
import type { EmailPalette } from '../email-palette.js';

/**
 * Generates the plain-text body for an account-deletion confirmation email.
 *
 * Sent when a magic-link-only-no-MFA account requests deletion: the user must
 * click the link to permanently delete the account. The 15-minute expiry must
 * stay in sync with the token expiry set in `AuthService.deleteAccount`.
 * @param url - The fully qualified confirmation URL with the raw token as a
 *   query parameter.
 * @returns A plain-text string ready to pass to the mail transport's `text`
 *   field.
 */
export const text = (url: string) =>
  `You requested to permanently delete your Linklater account. Click the link below to confirm. This link expires in 15 minutes.\n\n${url}\n\nIf you did not request this, ignore this email and your account stays as-is.`;

/**
 * Generates the HTML body for an account-deletion confirmation email using
 * the shared `baseHtml` layout template.
 *
 * The 15-minute expiry message must stay in sync with the token expiry set
 * in `AuthService.deleteAccount`. If the expiry changes, update both the
 * body text here and the `text` export above.
 * @param url - The fully qualified confirmation URL with the raw token as a
 *   query parameter.
 * @param palette - Color values derived from the user's saved theme
 *   preference, used to tint the email to match the app's appearance.
 * @returns An HTML string ready to pass to the mail transport's `html`
 *   field.
 */
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
