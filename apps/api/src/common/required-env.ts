/**
 * Validates that required environment variables are set. Exits the process
 * immediately with a clear diagnostic if any are missing - better to fail at
 * startup than to discover a missing key during a live request. Call this once,
 * early in bootstrap, before `app.listen`.
 *
 * Only variables whose absence breaks core runtime behaviour are hard-required:
 * - `DATABASE_URL`       - no database means the app cannot serve any request.
 * - `JWT_SECRET`         - session tokens cannot be signed or verified.
 * - `TOTP_ENCRYPTION_KEY`- MFA secrets cannot be encrypted/decrypted at rest.
 * - `APP_URL`            - every transactional email (verification, password
 *   reset, magic link, account deletion) and the OAuth redirect targets embed
 *   this origin; an unset value ships dead `undefined/...` links to users.
 *
 * Deliberately NOT hard-required (the app degrades gracefully without them):
 * - `PORT`                - defaults to `3000` (see `app.listen`).
 * - `CORS_ORIGIN`         - defaults to open `*` for bookmarklet support.
 * - `SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURE`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM`
 *   - email sending is optional in development (`SMTP_PORT` defaults to 587,
 *   `SMTP_FROM` defaults to a noreply address); run Mailpit locally to catch
 *   mail.
 * - `GOOGLE_*` / `APPLE_*` / `GOOGLE_LINK_CALLBACK_URL` - SSO providers are
 *   registered only when their full credential set is present
 *   (`auth.module.ts`); absent means that provider is simply disabled.
 * - `EXTENSION_REDIRECT_URIS` - browser-extension auth redirect allowlist;
 *   empty means no extension origins are trusted.
 */
export function validateRequiredEnvVars(): void {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'TOTP_ENCRYPTION_KEY',
    'APP_URL',
  ];

  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    console.error(
      `[startup] Missing required environment variables: ${missing.join(', ')}`,
    );
    process.exit(1);
  }

  if (!/^[0-9a-fA-F]{64}$/.test(process.env.TOTP_ENCRYPTION_KEY ?? '')) {
    console.error(
      '[startup] TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
    );
    process.exit(1);
  }
}
