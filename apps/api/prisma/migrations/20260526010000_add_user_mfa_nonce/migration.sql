set lock_timeout = '1s';
set statement_timeout = '5s';

-- Adds a per-user MFA nonce that binds an outstanding MFA challenge token
-- to the user row. AuthService.login generates a fresh nonce when issuing
-- a TOTP challenge JWT; AuthService.verifyOtp checks the JWT's nonce
-- against the column and clears it on success, enforcing single-use
-- semantics. A leaked MFA token can be invalidated by rotating the column.
ALTER TABLE "User" ADD COLUMN "mfaNonce" TEXT;
