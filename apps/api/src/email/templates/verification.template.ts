import { baseHtml } from './base.html.js';

export const text = (url: string) =>
  `Verify your Linklater email by visiting: ${url}\n\nThis link expires in 24 hours.`;

export const html = (url: string) =>
  baseHtml({
    heading: 'Verify your email.',
    bodyText:
      'Thanks for signing up for Linklater! Click the button below to verify your email address.',
    buttonLabel: 'Verify Email',
    buttonUrl: url,
    footerNote:
      'This link expires in 24 hours. If you did not create a Linklater account, you can safely ignore this email.',
  });
