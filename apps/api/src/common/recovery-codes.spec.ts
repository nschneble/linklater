import {
  findMatchingRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCodes,
  normalizeRecoveryCode,
} from './recovery-codes.js';

describe('generateRecoveryCodes', () => {
  it('generates exactly 10 codes', () => {
    expect(generateRecoveryCodes()).toHaveLength(10);
  });

  it('each code has format xxxxx-xxxxx-xxxxx (three 5-char groups)', () => {
    for (const code of generateRecoveryCodes()) {
      expect(code).toMatch(/^[^01IOl]{5}-[^01IOl]{5}-[^01IOl]{5}$/);
    }
  });

  it('codes contain only unambiguous alphanumeric characters', () => {
    const ambiguous = /[01IOl]/;
    for (const code of generateRecoveryCodes()) {
      const withoutDash = code.replace('-', '');
      expect(withoutDash).not.toMatch(ambiguous);
    }
  });

  it('generates unique codes within a single call', () => {
    const codes = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(codes.length);
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

describe('normalizeRecoveryCode', () => {
  it('returns a canonical code unchanged', () => {
    expect(normalizeRecoveryCode('abcde-fghij-kmnpq')).toBe(
      'abcde-fghij-kmnpq',
    );
  });

  it('inserts hyphens into a hyphenless 15-char payload', () => {
    expect(normalizeRecoveryCode('abcdefghijkmnpq')).toBe('abcde-fghij-kmnpq');
  });

  it('strips spaces between groups before re-inserting hyphens', () => {
    expect(normalizeRecoveryCode('abcde fghij kmnpq')).toBe(
      'abcde-fghij-kmnpq',
    );
  });

  it('strips surrounding whitespace', () => {
    expect(normalizeRecoveryCode('  abcde-fghij-kmnpq  ')).toBe(
      'abcde-fghij-kmnpq',
    );
  });

  it('handles uppercase characters', () => {
    expect(normalizeRecoveryCode('ABCDE-FGHJK-MNPQR')).toBe(
      'ABCDE-FGHJK-MNPQR',
    );
  });

  it('returns null when the payload is too short', () => {
    expect(normalizeRecoveryCode('abcde-fghij')).toBeNull();
  });

  it('returns null when the payload is too long', () => {
    expect(normalizeRecoveryCode('abcde-fghij-kmnpq-rstuv')).toBeNull();
  });

  it('returns null when the payload contains ambiguous characters (0, 1, I, O, l)', () => {
    expect(normalizeRecoveryCode('0bcde-fghij-kmnpq')).toBeNull();
    expect(normalizeRecoveryCode('1bcde-fghij-kmnpq')).toBeNull();
    expect(normalizeRecoveryCode('Ibcde-fghij-kmnpq')).toBeNull();
    expect(normalizeRecoveryCode('Obcde-fghij-kmnpq')).toBeNull();
    expect(normalizeRecoveryCode('lbcde-fghij-kmnpq')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(normalizeRecoveryCode('')).toBeNull();
  });

  it('returns null when payload contains other punctuation', () => {
    expect(normalizeRecoveryCode('abcde.fghij.kmnpq')).toBeNull();
  });

  it('round-trips a freshly generated code through normalization', () => {
    for (const code of generateRecoveryCodes()) {
      expect(normalizeRecoveryCode(code)).toBe(code);
      // hyphenless form must also map back to the original
      expect(normalizeRecoveryCode(code.replace(/-/g, ''))).toBe(code);
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
