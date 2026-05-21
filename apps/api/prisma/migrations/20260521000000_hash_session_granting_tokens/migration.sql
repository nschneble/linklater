set lock_timeout = '1s';
set statement_timeout = '5s';

-- The verification, password reset, magic link, and pending email tokens now
-- store a SHA-256 hash of the raw token rather than the raw value. Any
-- outstanding plaintext tokens issued before this deploy would still match
-- their original raw form, which is no longer the storage format — invalidate
-- them so users request fresh links.
update "User"
set
  "verificationToken" = null,
  "verificationTokenExpiresAt" = null,
  "resetToken" = null,
  "resetTokenExpiresAt" = null,
  "magicLinkToken" = null,
  "magicLinkTokenExpiresAt" = null,
  "pendingEmailToken" = null,
  "pendingEmailTokenExpiresAt" = null,
  "pendingEmail" = null
where
  "verificationToken" is not null
  or "resetToken" is not null
  or "magicLinkToken" is not null
  or "pendingEmailToken" is not null;
