import { decrypt, encrypt } from './crypto.js';

const TEST_KEY = 'a'.repeat(64);

describe('encrypt / decrypt', () => {
  it('round-trips plaintext correctly', () => {
    const plaintext = 'super-secret-totp-base32';
    expect(decrypt(encrypt(plaintext, TEST_KEY), TEST_KEY)).toBe(plaintext);
  });

  it('produces different ciphertext on each call (random IV)', () => {
    const plaintext = 'same-value';
    expect(encrypt(plaintext, TEST_KEY)).not.toBe(encrypt(plaintext, TEST_KEY));
  });

  it('throws when decrypting with the wrong key', () => {
    const ciphertext = encrypt('value', TEST_KEY);
    expect(() => decrypt(ciphertext, 'b'.repeat(64))).toThrow();
  });

  it('throws when the ciphertext has been tampered with', () => {
    const ciphertext = encrypt('value', TEST_KEY);
    const tampered = ciphertext.slice(0, -4) + 'ffff';
    expect(() => decrypt(tampered, TEST_KEY)).toThrow();
  });
});
