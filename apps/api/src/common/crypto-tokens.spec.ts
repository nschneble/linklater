import { describe, expect, it } from '@jest/globals';
import { createHash } from 'node:crypto';
import { generateHexToken, sha256Hex } from './crypto-tokens.js';

describe('sha256Hex', () => {
  it('returns the SHA-256 hash of the input as 64 lowercase hex characters', () => {
    const hash = sha256Hex('hello world');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // known test vector for "hello world"
    expect(hash).toBe(
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    );
  });

  it('is deterministic – the same input always hashes to the same digest', () => {
    const input = 'session-token-abc';
    expect(sha256Hex(input)).toBe(sha256Hex(input));
  });

  it('produces different hashes for different inputs', () => {
    expect(sha256Hex('a')).not.toBe(sha256Hex('b'));
  });

  it('matches a direct node:crypto SHA-256 hex digest', () => {
    const input = 'arbitrary-input-string';
    const expected = createHash('sha256').update(input).digest('hex');
    expect(sha256Hex(input)).toBe(expected);
  });

  it('handles empty input', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

describe('generateHexToken', () => {
  it('returns a 64-character lowercase hex string', () => {
    expect(generateHexToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns a different value on each invocation', () => {
    // collision across two 256-bit values is effectively zero
    const samples = new Set(
      Array.from({ length: 50 }, () => generateHexToken()),
    );
    expect(samples.size).toBe(50);
  });

  it('decodes back to 32 bytes', () => {
    expect(Buffer.from(generateHexToken(), 'hex').byteLength).toBe(32);
  });
});
