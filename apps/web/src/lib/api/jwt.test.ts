/**
 * Tests for the unverified JWT claim reader.
 *
 * The decoder's whole contract is that it never throws and never invents a
 * claim, so most cases here are malformed input paired with the shape the
 * caller is entitled to see. The two claims it exposes are pinned both
 * present and absent, because a caller branching on `null` needs the
 * absent case to be `null` itself rather than `undefined` or `NaN`.
 *
 * Payloads here are assembled by hand, which is what makes them useless
 * for proving the reader looks at the claim the server signs. That is
 * `jwt.serverContract.test.ts`'s job.
 */

import { describe, expect, it } from 'vitest';
import { readTokenClaims } from './jwt';

function encodeSegment(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

/** Builds a token around an already-serialized payload. */
function makeRawToken(payloadJson: string): string {
  return [
    encodeSegment(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    encodeSegment(payloadJson),
    'not-a-real-signature',
  ].join('.');
}

function makeToken(payload: unknown): string {
  return makeRawToken(JSON.stringify(payload));
}

describe('readTokenClaims – well-formed tokens', () => {
  it('reads the subject off the payload', () => {
    expect(readTokenClaims(makeToken({ subject: 'user-1' }))?.subject).toBe(
      'user-1',
    );
  });

  it('reads the expiry off the payload', () => {
    expect(readTokenClaims(makeToken({ exp: 1893456000 }))?.exp).toBe(
      1893456000,
    );
  });

  it('reads both claims off one payload', () => {
    expect(readTokenClaims(makeToken({ exp: 42, subject: 'user-9' }))).toEqual({
      exp: 42,
      subject: 'user-9',
    });
  });

  it('survives a padding-free segment, which is how JWTs are emitted', () => {
    // 'a' repeated until the base64 needs padding the encoder then strips
    const token = makeToken({ subject: 'aaa' });
    expect(token.split('.')[1]).not.toContain('=');
    expect(readTokenClaims(token)?.subject).toBe('aaa');
  });

  it('decodes a multi-byte subject rather than mangling it', () => {
    expect(readTokenClaims(makeToken({ subject: 'usér-Ø-日' }))?.subject).toBe(
      'usér-Ø-日',
    );
  });

  it('decodes a segment spelled in base64url, which is the only spelling', () => {
    // chosen for its bytes: the payload needs both substitutions present
    const subject = 'userÿ😀';
    const segment = makeToken({ subject }).split('.')[1] ?? '';

    expect(segment).toContain('-');
    expect(segment).toContain('_');
    expect(readTokenClaims(makeToken({ subject }))?.subject).toBe(subject);
  });
});

describe('readTokenClaims – which claim the subject comes from', () => {
  it('reads a standard `sub`, so a later issuer emitting one needs no change', () => {
    expect(readTokenClaims(makeToken({ sub: 'user-1' }))?.subject).toBe(
      'user-1',
    );
  });

  it('prefers `subject`, the claim this API signs, when both are present', () => {
    const token = makeToken({ sub: 'standard', subject: 'signed' });
    expect(readTokenClaims(token)?.subject).toBe('signed');
  });

  it('falls back to `sub` when `subject` is present but not a string', () => {
    // a mistyped preferred claim must not suppress a usable standard one
    const token = makeToken({ sub: 'usable', subject: 12345 });
    expect(readTokenClaims(token)?.subject).toBe('usable');
  });
});

describe('readTokenClaims – claims that are present but unusable', () => {
  it('answers null for a subject the server sent as a number', () => {
    expect(readTokenClaims(makeToken({ subject: 12345 }))?.subject).toBeNull();
  });

  it('answers null for a subject the server sent as an object', () => {
    const token = makeToken({ subject: { id: 'x' } });
    expect(readTokenClaims(token)?.subject).toBeNull();
  });

  it('answers null for an expiry sent as a numeric string', () => {
    expect(readTokenClaims(makeToken({ exp: '1893456000' }))?.exp).toBeNull();
  });

  it('answers null for a NaN expiry, which would win every comparison', () => {
    // NaN does not survive JSON, so a caller meets it via Number('nope')
    const claims = readTokenClaims(makeToken({ exp: null }));
    expect(claims?.exp).toBeNull();
    expect(Number.isNaN(claims?.exp)).toBe(false);
  });

  it('answers null for an expiry whose exponent overflows to Infinity', () => {
    // JSON.parse yields Infinity here, and Infinity outlives every deadline
    const claims = readTokenClaims(makeRawToken('{"exp":1e400}'));
    expect(claims?.exp).toBeNull();
  });

  it('answers null for each claim the payload omits', () => {
    expect(readTokenClaims(makeToken({ iat: 1 }))).toEqual({
      exp: null,
      subject: null,
    });
  });
});

describe('readTokenClaims – garbage in, null out', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['a bare word', 'nonsense'],
    ['an ltk_ API token, which has no payload segment', 'ltk_abc123def456'],
    ['a two-segment token', 'aGVhZGVy.eyJzdWIiOiJ1c2VyLTEifQ'],
    ['a four-segment token', 'a.b.c.d'],
    ['a payload outside the base64 alphabet', 'aaa.@@@@@@.ccc'],
    ['a payload that is not JSON', `aaa.${encodeSegment('not json')}.ccc`],
    ['a payload that is a JSON string', `aaa.${encodeSegment('"user-1"')}.ccc`],
    ['a payload that is a JSON number', `aaa.${encodeSegment('7')}.ccc`],
    ['a payload that is JSON null', `aaa.${encodeSegment('null')}.ccc`],
  ])('answers null for %s', (_description, token) => {
    expect(readTokenClaims(token)).toBeNull();
  });

  it('answers null for an array payload rather than reading its indices', () => {
    // an array passes a naive typeof check, and its indices read as keys
    expect(readTokenClaims(makeToken(['user-1']))).toBeNull();
  });

  it('never throws on any of the malformed shapes', () => {
    const shapes = ['', '.', '..', 'a.b.c', '\0.\0.\0'];
    for (const shape of shapes) {
      expect(() => readTokenClaims(shape)).not.toThrow();
    }
  });
});
