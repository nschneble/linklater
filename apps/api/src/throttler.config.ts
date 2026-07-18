/**
 * Named rate-limit buckets for the app, consumed by `ThrottlerModule.forRoot`
 * in `app.module.ts`.
 *
 * IMPORTANT: `@nestjs/throttler` v6 only ever evaluates throttlers that are
 * declared here. A `@Throttle({ 'name': { ttl, limit } })` decorator whose
 * name is NOT in this list is silently ignored — the route falls back to the
 * union of every declared bucket instead of binding its own limit. Every
 * `@Throttle` name used on a controller MUST therefore appear here with the
 * exact ttl/limit its decorator specifies. `throttler.config.spec.ts` locks
 * this invariant both directions (no undeclared decorator, no unused bucket).
 */
export interface NamedThrottler {
  name: string;
  ttl: number;
  limit: number;
}

export const THROTTLER_CONFIG: NamedThrottler[] = [
  // Password + email account flows
  { name: 'auth-register', ttl: 60000, limit: 5 },
  { name: 'auth-login', ttl: 60000, limit: 10 },
  { name: 'auth-refresh', ttl: 60000, limit: 10 },
  { name: 'auth-forgot-password', ttl: 60000, limit: 3 },
  { name: 'auth-reset-password', ttl: 60000, limit: 5 },
  { name: 'auth-verify-email', ttl: 60000, limit: 10 },
  { name: 'auth-resend-verification', ttl: 60000, limit: 3 },
  { name: 'auth-request-email-change', ttl: 60000, limit: 3 },
  { name: 'auth-resend-email-change', ttl: 60000, limit: 3 },
  { name: 'auth-verify-email-change', ttl: 60000, limit: 10 },
  // Magic-link (passwordless) flow
  { name: 'auth-request-magic-link', ttl: 60000, limit: 3 },
  { name: 'auth-verify-magic-link', ttl: 60000, limit: 10 },
  // Browser-extension token exchange
  { name: 'auth-extension-token', ttl: 60000, limit: 20 },
  // MFA login step 2 – tighter window to slow brute-force on OTP codes
  { name: 'auth-verify-otp', ttl: 900000, limit: 5 },
  // MFA setup
  { name: 'auth-mfa-totp-setup', ttl: 60000, limit: 5 },
  // MFA TOTP verification during setup – matches the OTP brute-force window
  { name: 'auth-mfa-totp-verify', ttl: 900000, limit: 5 },
  // MFA disable – most sensitive action; matches verify-otp window
  { name: 'auth-disable-mfa', ttl: 900000, limit: 5 },
  // Re-auth gate for recovery code operations
  { name: 'auth-reauth', ttl: 900000, limit: 5 },
  // Account deletion – confirm/cancel the pending deletion window
  { name: 'auth-account-deletion-confirm', ttl: 900000, limit: 5 },
  { name: 'auth-account-deletion-cancel', ttl: 900000, limit: 10 },
  // PAT creation – JWT-gated, so no brute-force vector, but caps a
  // compromised or runaway session from spamming token rows (20 / hour)
  { name: 'token-create', ttl: 3600000, limit: 20 },
];
