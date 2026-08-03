import { resolveEmailPalette } from './email-palette.js';
import * as ConfirmAccountDeletionTemplate from './templates/confirm-account-deletion.template.js';
import * as EmailChangeTemplate from './templates/email-change.template.js';
import * as MagicLinkTemplate from './templates/magic-link.template.js';
import * as PasswordResetTemplate from './templates/password-reset.template.js';
import * as PolicyUpdateTemplate from './templates/policy-update.template.js';
import * as VerificationTemplate from './templates/verification.template.js';

// deterministic sample inputs so every preview renders byte-identically on
// every run. Real sends use a live token and the recipient's saved theme;
// pinning both here means a screenshot changes only when template markup does.
// A full-length 64-char hex token keeps the "copy this link" line wrapping
// faithful to a real email.
const SAMPLE_TOKEN =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const SAMPLE_APP_URL = 'https://linklater.app';
const SAMPLE_EFFECTIVE_DATE = 'January 1, 2026';
const SAMPLE_PALETTE = resolveEmailPalette('scanner-darkly');

export interface EmailPreview {
  slug: string;
  title: string;
  html: string;
}

// one entry per transactional email the API sends. The slug mirrors the
// template filename and each sample link path mirrors email.service.ts.
// adding a template here (plus a matching Tuffgal action + story step) keeps
// the visual-regression coverage complete.
export const emailPreviews: readonly EmailPreview[] = [
  {
    slug: 'verification',
    title: 'Email verification',
    html: VerificationTemplate.html(
      `${SAMPLE_APP_URL}/verify-email?token=${SAMPLE_TOKEN}`,
      SAMPLE_PALETTE,
    ),
  },
  {
    slug: 'password-reset',
    title: 'Password reset',
    html: PasswordResetTemplate.html(
      `${SAMPLE_APP_URL}/reset-password?token=${SAMPLE_TOKEN}`,
      SAMPLE_PALETTE,
    ),
  },
  {
    slug: 'email-change',
    title: 'Email address change',
    html: EmailChangeTemplate.html(
      `${SAMPLE_APP_URL}/verify-email-change?token=${SAMPLE_TOKEN}`,
      SAMPLE_PALETTE,
    ),
  },
  {
    slug: 'magic-link',
    title: 'Magic-link login',
    html: MagicLinkTemplate.html(
      `${SAMPLE_APP_URL}/verify-login?token=${SAMPLE_TOKEN}`,
      SAMPLE_PALETTE,
    ),
  },
  {
    slug: 'confirm-account-deletion',
    title: 'Account deletion',
    html: ConfirmAccountDeletionTemplate.html(
      `${SAMPLE_APP_URL}/account/confirm-deletion?token=${SAMPLE_TOKEN}`,
      SAMPLE_PALETTE,
    ),
  },
  {
    slug: 'policy-update',
    title: 'Privacy policy update',
    html: PolicyUpdateTemplate.html(
      `${SAMPLE_APP_URL}/privacy`,
      SAMPLE_EFFECTIVE_DATE,
      SAMPLE_PALETTE,
    ),
  },
];
