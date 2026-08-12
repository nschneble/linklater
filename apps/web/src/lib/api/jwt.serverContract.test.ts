/**
 * The contract between this decoder and the server that signs the tokens
 * it reads.
 *
 * Nothing else pins the two workspaces together. `jwt.test.ts` assembles
 * its payloads by hand and every consumer mocks this module wholesale, so
 * a decoder reading a claim the API has never signed passes all of them
 * and still returns `null` for every real token. This suite mints through
 * the same `@nestjs/jwt` `JwtService` the API mints through, with the same
 * call shape, so that gap cannot open again in silence.
 *
 * `@nestjs/jwt` is a devDependency of this workspace for this file alone.
 */

import { describe, expect, it } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { readTokenClaims } from './jwt';

const USER_ID = '0f8d1c2e-4a6b-4f21-9c3e-7b5a1d9e0f42';

/**
 * Mirrors `issueTokenPair` in
 * `apps/api/src/auth/refresh-token.service.ts`, down to the payload field
 * names, plus the `expiresIn` that `JwtModule.register` in
 * `apps/api/src/auth/auth.module.ts` applies to every token it signs.
 * Change either of those and change this.
 */
function mintAccessTokenTheWayTheApiDoes(userId: string = USER_ID): string {
  const jwtService = new JwtService({
    secret: 'contract-test-secret',
    signOptions: { expiresIn: '1h' },
  });
  return jwtService.sign({
    subject: userId,
    email: 'user@example.com',
    tokenVersion: 0,
  });
}

function decodePayload(token: string): Record<string, unknown> {
  const segment = token.split('.')[1] ?? '';
  return JSON.parse(
    Buffer.from(segment, 'base64url').toString('utf8'),
  ) as Record<string, unknown>;
}

describe('a token minted the way the API mints one', () => {
  it('yields the user id, which is the whole point of reading it', () => {
    const claims = readTokenClaims(mintAccessTokenTheWayTheApiDoes());
    expect(claims?.subject).toBe(USER_ID);
  });

  it('yields an expiry, which only the signing options put there', () => {
    const claims = readTokenClaims(mintAccessTokenTheWayTheApiDoes());
    expect(typeof claims?.exp).toBe('number');
    expect(claims?.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it('distinguishes two users, so a switch is detectable at all', () => {
    const mine = readTokenClaims(mintAccessTokenTheWayTheApiDoes('user-1'));
    const theirs = readTokenClaims(mintAccessTokenTheWayTheApiDoes('user-2'));
    expect(mine?.subject).not.toBe(theirs?.subject);
  });
});

describe('the payload shape this decoder is answering', () => {
  it('carries the user id under `subject`, which is why the reader looks there', () => {
    const payload = decodePayload(mintAccessTokenTheWayTheApiDoes());
    expect(payload['subject']).toBe(USER_ID);
  });

  it('carries no standard `sub`, so reading only `sub` reads nothing', () => {
    const payload = decodePayload(mintAccessTokenTheWayTheApiDoes());
    expect(payload['sub']).toBeUndefined();
  });
});
