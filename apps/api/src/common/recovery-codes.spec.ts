import {
  findMatchingRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCodes,
} from './recovery-codes.js';

describe('generateRecoveryCodes', () => {
  it('generates exactly 10 codes', () => {
    expect(generateRecoveryCodes()).toHaveLength(10);
  });

  it('each code has format xxxxx-xxxxx (two 5-char groups)', () => {
    for (const code of generateRecoveryCodes()) {
      expect(code).toMatch(/^[^01IOl]{5}-[^01IOl]{5}$/);
    }
  });

  it('codes contain only unambiguous alphanumeric characters', () => {
    const ambiguous = /[01IOl]/;
    for (const code of generateRecoveryCodes()) {
      const withoutDash = code.replace('-', '');
      expect(withoutDash).not.toMatch(ambiguous);
    }
  });

  it('generates unique codes each call', () => {
    const setA = new Set(generateRecoveryCodes());
    const setB = new Set(generateRecoveryCodes());
    expect([...setA].some((code) => setB.has(code))).toBe(false);
  });
});

describe('hashRecoveryCodes', () => {
  it('returns the same number of hashes as codes', async () => {
    const codes = generateRecoveryCodes();
    const hashes = await hashRecoveryCodes(codes);
    expect(hashes).toHaveLength(codes.length);
  });

  it('hashes are different from the plaintext codes', async () => {
    const codes = generateRecoveryCodes();
    const hashes = await hashRecoveryCodes(codes);
    for (let index = 0; index < codes.length; index++) {
      expect(hashes[index]).not.toBe(codes[index]);
    }
  });
});

describe('findMatchingRecoveryCode', () => {
  it('returns index of the matching hash', async () => {
    const codes = ['aaaaa-bbbbb', 'ccccc-ddddd'];
    const hashes = await hashRecoveryCodes(codes);
    expect(await findMatchingRecoveryCode('ccccc-ddddd', hashes)).toBe(1);
  });

  it('returns null when no code matches', async () => {
    const codes = ['aaaaa-bbbbb'];
    const hashes = await hashRecoveryCodes(codes);
    expect(await findMatchingRecoveryCode('zzzzz-zzzzz', hashes)).toBeNull();
  });

  it('returns the correct index when multiple codes exist', async () => {
    const codes = ['aaaaa-bbbbb', 'ccccc-ddddd', 'eeeee-fffff'];
    const hashes = await hashRecoveryCodes(codes);
    expect(await findMatchingRecoveryCode('aaaaa-bbbbb', hashes)).toBe(0);
    expect(await findMatchingRecoveryCode('eeeee-fffff', hashes)).toBe(2);
  });
});
